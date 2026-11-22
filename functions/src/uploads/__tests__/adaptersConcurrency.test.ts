/**
 * The Storage emulator ignores `ifGenerationMatch`, so the emulator lane
 * cannot show the ledger adapter serializes admissions. This fakes GCS at
 * the Admin SDK boundary with real generations and the 412 precondition,
 * then runs the real adapter and handler (#486).
 */
import {
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BYTES_PER_UID,
  UPLOAD_GRANTS_CLAIM,
  uploadQuotaLedgerPath,
} from '../../submissionLayout'
import { createUploadAdmissionPorts } from '../adapters'
import { handleAdmitPhotoUpload } from '../admission'

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
          if (!value || options?.generation !== value.generation)
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
    verifyIdToken: async (token: string) => ({ uid: token }),
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

const UID = 'uid-1'
const ports = createUploadAdmissionPorts('bucket')
const admitSlot = (submissionId: string) =>
  handleAdmitPhotoUpload(
    {
      authorization: `Bearer ${UID}`,
      body: { submissionId, slot: 0, raw: false },
    },
    ports,
  )

beforeEach(() => {
  mockObjects.clear()
  mockSizes.clear()
  mockClaims.clear()
})

test('concurrent admissions retry the generation conflict and cannot overspend', async () => {
  mockSizes.set(
    `submissions/${UID}/old/photo-0.jpg`,
    MAX_UPLOAD_BYTES_PER_UID - MAX_PHOTO_BYTES,
  )

  const results = await Promise.all([admitSlot('s1'), admitSlot('s2')])

  expect(results.map((r) => r.status).sort()).toEqual([200, 429])
  const ledger = JSON.parse(mockObjects.get(uploadQuotaLedgerPath(UID))!.text)
  expect(Object.keys(ledger.grants)).toHaveLength(1)
  expect(
    Object.keys(mockClaims.get(UID)![UPLOAD_GRANTS_CLAIM] as object),
  ).toEqual(Object.keys(ledger.grants))
})

test('concurrent admissions with headroom both land in the ledger', async () => {
  mockClaims.set(UID, { submissionCapReached: true })

  const results = await Promise.all([admitSlot('s1'), admitSlot('s2')])

  expect(results.map((r) => r.status)).toEqual([200, 200])
  const ledger = JSON.parse(mockObjects.get(uploadQuotaLedgerPath(UID))!.text)
  expect(Object.keys(ledger.grants).sort()).toEqual(['s1', 's2'])
  // Publishing keeps the uid's other claims.
  expect(mockClaims.get(UID)).toMatchObject({ submissionCapReached: true })
})
