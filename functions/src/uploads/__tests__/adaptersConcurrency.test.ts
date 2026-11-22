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
  uidIndexPath,
} from '../../submissionLayout'
import {
  createUploadAdmissionPorts,
  deleteLateErasedUpload,
  retireUploadIdentity,
} from '../adapters'
import { handleAdmitPhotoUpload, type PersonLedger } from '../admission'

const mockObjects = new Map<string, { generation: number; text: string }>()
const mockSizes = new Map<string, number>()
const mockUsers = new Map<string, { email: string; emailVerified: boolean }>()
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
          mockSizes.delete(path)
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
    verifyIdToken: async (uid: string) => ({ uid }),
    getUser: async (uid: string) => ({
      uid,
      ...mockUsers.get(uid),
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
const admitAs = (
  uid: string,
  body: unknown,
  email = EMAIL,
  emailVerified = true,
) => {
  mockUsers.set(uid, { email, emailVerified })
  return handleAdmitPhotoUpload({ authorization: `Bearer ${uid}`, body }, ports)
}
const slot = (submissionId: string) => ({ submissionId, slot: 0, raw: false })
const ledgers = (): PersonLedger[] =>
  [...mockObjects]
    .filter(([path]) => path.includes('/persons/'))
    .map(([, { text }]) => JSON.parse(text) as PersonLedger)

beforeEach(() => {
  mockObjects.clear()
  mockSizes.clear()
  mockClaims.clear()
  mockUsers.clear()
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
      uids: ['uid-old', 'uid-new'],
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

test('an unverified account cannot bind or spend quota for its claimed email', async () => {
  expect(await admitAs('unverified', slot('s1'), EMAIL, false)).toEqual({
    status: 403,
    body: { error: 'email_verification_required' },
  })
  expect(mockObjects.size).toBe(0)
  expect(mockClaims.size).toBe(0)
  expect((await admitAs('owner', slot('s1'))).status).toBe(200)
  expect(ledgers()[0].uids).toEqual(['owner'])
})

test('erasure fences an admission that already read the ledger', async () => {
  expect((await admitAs('uid-old', slot('s1'))).status).toBe(200)
  const claims = mockClaims.get('uid-old')
  let resume!: () => void
  let loaded!: () => void
  const paused = new Promise<void>((resolve) => {
    loaded = resolve
  })
  const resumeWrite = new Promise<void>((resolve) => {
    resume = resolve
  })
  const incoming = handleAdmitPhotoUpload(
    { authorization: 'Bearer uid-old', body: slot('s2') },
    {
      ...ports,
      writeLedger: async (...args) => {
        loaded()
        await resumeWrite
        return ports.writeLedger(...args)
      },
    },
  )

  await paused
  try {
    await retireUploadIdentity('bucket', 'uid-old', true)
  } finally {
    resume()
  }
  expect(await incoming).toEqual({
    status: 403,
    body: { error: 'account_erasing' },
  })
  expect(mockClaims.get('uid-old')).toEqual(claims)
  expect(Object.keys(ledgers()[0].grants['uid-old'])).toEqual(['s1'])
})

test('erasure of a UID with no pointer blocks a first admission', async () => {
  await retireUploadIdentity('bucket', 'uid-old', true)
  expect((await admitAs('uid-old', slot('s1'))).status).toBe(403)
  expect(ledgers()).toHaveLength(0)
  expect(JSON.parse(mockObjects.get(uidIndexPath('uid-old'))!.text)).toEqual({
    erasing: true,
    deleteSightings: true,
  })
})

test.each([true, false])(
  'preserves reservations and honors deleteSightings=%s for late uploads',
  async (deleteSightings) => {
    expect((await admitAs('uid-old', slot('s1'))).status).toBe(200)
    await retireUploadIdentity('bucket', 'uid-old', deleteSightings)
    mockSizes.set(
      'submissions/uid-new/old/photo-0.jpg',
      MAX_UPLOAD_BYTES_PER_UID - MAX_PHOTO_BYTES,
    )
    expect((await admitAs('uid-new', slot('s2'))).status).toBe(429)

    const latePhoto = 'submissions/uid-old/s1/photo-0.jpg'
    mockSizes.set(latePhoto, 100)
    expect(await deleteLateErasedUpload('bucket', latePhoto, 1)).toBe(
      deleteSightings,
    )
    expect(mockSizes.has(latePhoto)).toBe(!deleteSightings)
    expect((await admitAs('uid-new', slot('s2'))).status).toBe(429)
  },
)
