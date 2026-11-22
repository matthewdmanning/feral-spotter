/**
 * The Storage emulator ignores `ifGenerationMatch`, so the emulator lane
 * cannot show the adapters serialize admissions or bind pointers once. This
 * fakes GCS at the Admin SDK boundary with real generations and the 412
 * precondition, then runs the real adapters and handler (#486).
 */
import {
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BYTES_PER_UID,
  UPLOAD_GRANTS_CLAIM,
} from '../../submissionLayout'
import { createUploadAdmissionPorts, retireUploadIdentity } from '../adapters'
import { handleAdmitPhotoUpload, type PersonLedger } from '../admission'

const mockObjects = new Map<string, { generation: number; text: string }>()
const mockSizes = new Map<string, number>()
const mockClaims = new Map<string, Record<string, unknown>>()
const tick = () => new Promise((resolve) => setImmediate(resolve))
const notFound = () => Object.assign(new Error('not found'), { code: 404 })

jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string, options?: { generation?: number }) => ({
        getMetadata: async () => {
          await tick()
          const value = mockObjects.get(path)
          if (!value) throw notFound()
          return [{ generation: String(value.generation) }]
        },
        download: async () => {
          await tick()
          const value = mockObjects.get(path)
          if (
            !value ||
            (options?.generation !== undefined &&
              options.generation !== value.generation)
          )
            throw notFound()
          return [Buffer.from(value.text)]
        },
        save: async (
          text: string,
          {
            preconditionOpts,
          }: { preconditionOpts: { ifGenerationMatch: number } },
        ) => {
          await tick()
          const generation = mockObjects.get(path)?.generation ?? 0
          if (generation !== preconditionOpts.ifGenerationMatch)
            throw Object.assign(new Error('precondition'), { code: 412 })
          mockObjects.set(path, { generation: generation + 1, text })
        },
        delete: async () => {
          mockObjects.delete(path)
        },
      }),
      getFiles: async ({ prefix }: { prefix: string }) => [
        [...mockSizes]
          .filter(([name]) => name.startsWith(prefix))
          .map(([name, size]) => ({ name, metadata: { size: String(size) } })),
      ],
    }),
  }),
}))
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    // Test tokens are "uid|email".
    verifyIdToken: async (token: string) => {
      const [uid, email] = token.split('|')
      return { uid, email }
    },
    getUser: async (uid: string) => ({
      uid,
      customClaims: mockClaims.get(uid),
    }),
    setCustomUserClaims: async (
      uid: string,
      claims: Record<string, unknown>,
    ) => {
      mockClaims.set(uid, claims)
    },
  }),
}))

const EMAIL = 'me@example.com'
const ports = createUploadAdmissionPorts('bucket', () => 'test-key')
const admitAs = (uid: string, body: unknown, email = EMAIL) =>
  handleAdmitPhotoUpload(
    { authorization: `Bearer ${uid}|${email}`, body },
    ports,
  )
const slot = (submissionId: string) => ({ submissionId, slot: 0, raw: false })
const ledgers = (): PersonLedger[] =>
  [...mockObjects]
    .filter(([path]) => path.includes('/persons/'))
    .map(([, { text }]) => JSON.parse(text) as PersonLedger)

beforeEach(() => {
  mockObjects.clear()
  mockSizes.clear()
  mockClaims.clear()
})

test('concurrent admissions retry the generation conflict and cannot overspend', async () => {
  mockSizes.set(
    'submissions/uid-1/old/photo-0.jpg',
    MAX_UPLOAD_BYTES_PER_UID - MAX_PHOTO_BYTES,
  )

  const results = await Promise.all([
    admitAs('uid-1', slot('s1')),
    admitAs('uid-1', slot('s2')),
  ])

  expect(results.map((r) => r.status).sort()).toEqual([200, 429])
  const [ledger] = ledgers()
  expect(Object.keys(ledger.grants['uid-1'])).toHaveLength(1)
  expect(
    Object.keys(mockClaims.get('uid-1')![UPLOAD_GRANTS_CLAIM] as object),
  ).toEqual(Object.keys(ledger.grants['uid-1']))
})

test('two sign-in methods with one email share one ledger and one quota', async () => {
  // Concurrent first admissions race to bind the same email pointer.
  const results = await Promise.all([
    admitAs('uid-google', slot('s1')),
    admitAs('uid-password', slot('s2')),
  ])
  expect(results.map((r) => r.status)).toEqual([200, 200])
  expect(ledgers()).toHaveLength(1)
  expect(ledgers()[0].uids.sort()).toEqual(['uid-google', 'uid-password'])

  // One account's stored bytes leave no room for the other.
  mockSizes.set(
    'submissions/uid-google/s1/photo-1.jpg',
    MAX_UPLOAD_BYTES_PER_UID,
  )
  expect((await admitAs('uid-password', slot('s3'))).status).toBe(429)

  // Publishing keeps each uid's other claims.
  mockSizes.clear()
  mockClaims.set('uid-google', { submissionCapReached: true })
  await admitAs('uid-google', slot('s1'))
  expect(mockClaims.get('uid-google')).toMatchObject({
    submissionCapReached: true,
  })
})

test('erasing and recreating the account keeps the lifetime count', async () => {
  const metadata = (submissionId: string) => ({ submissionId, metadata: true })
  expect((await admitAs('uid-old', metadata('s1'))).status).toBe(200)

  await retireUploadIdentity('bucket', 'uid-old', true)
  await retireUploadIdentity('bucket', 'uid-old', true) // a retried erasure

  expect((await admitAs('uid-new', metadata('s2'))).status).toBe(200)
  expect(ledgers()).toEqual([
    expect.objectContaining({
      uids: ['uid-new'],
      submissions: ['uid-new/s2'],
      retiredSubmissions: 1,
    }),
  ])
})

test('the ledger and its index never hold the email address', async () => {
  await admitAs('uid-1', slot('s1'), 'Me@Example.com')
  expect(mockObjects.size).toBeGreaterThan(0)
  expect(JSON.stringify([...mockObjects]).toLowerCase()).not.toContain(
    'example.com',
  )
})
