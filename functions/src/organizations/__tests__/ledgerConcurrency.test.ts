/**
 * The Firebase Storage emulator ignores `ifGenerationMatch`, so the real
 * emulator lane cannot catch a lost ledger update. This narrow fake models only
 * object generations and that precondition; everything else runs through the
 * real handler. Other API behavior is covered in `emulator-tests/`.
 */
import type { Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { DEFAULT_SHARING, type PermissionLedger } from '../domain'

// firebase-functions params only fall back to defaults inside a deploy or emulator.
process.env.ORGANIZATIONS_CATALOG_PATH = 'catalog.json'
const mockObjects = new Map<string, { generation: number; text: string }>()
const conflict = () => Object.assign(new Error('conflict'), { code: 412 })
const missing = () => Object.assign(new Error('missing'), { code: 404 })
// Holds every request after its ledger read until both have read it.
let mockArrived = 0
let mockRelease: () => void
const mockBothRead = new Promise<void>((resolve) => (mockRelease = resolve))
const mockBarrier = () => {
  if (++mockArrived === 2) mockRelease()
  return mockBothRead
}
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: async (uid: string) => ({ uid, email: `${uid}@x.test` }),
  }),
}))
jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string, options?: { generation?: number }) => ({
        getMetadata: async () => {
          const value = mockObjects.get(path)
          if (!value) throw missing()
          return [{ generation: String(value.generation) }]
        },
        download: async () => {
          if (path.endsWith('metadata.json')) await mockBarrier()
          const value = mockObjects.get(path)
          if (
            !value ||
            (options?.generation ?? value.generation) !== value.generation
          )
            throw missing()
          return [Buffer.from(value.text)]
        },
        save: async (
          text: string,
          {
            preconditionOpts,
          }: { preconditionOpts: { ifGenerationMatch: number } },
        ) => {
          const generation = mockObjects.get(path)?.generation ?? 0
          if (generation !== preconditionOpts.ifGenerationMatch)
            throw conflict()
          mockObjects.set(path, { generation: generation + 1, text })
        },
      }),
    }),
  }),
}))
import { handleOrganizationsRequest } from '../api'

function seed(path: string, value: unknown) {
  mockObjects.set(path, { generation: 1, text: JSON.stringify(value) })
}
async function grant(organizationId: string): Promise<number> {
  let status = 200
  const res = {
    set: () => res,
    status: (code: number) => ((status = code), res),
    json: () => res,
    end: () => res,
  } as unknown as Response
  await handleOrganizationsRequest(
    {
      method: 'POST',
      header: () => 'Bearer owner',
      body: {
        action: 'grant',
        mutationId: `grant-${organizationId}`,
        organizationId,
        grant: {
          submissionId: 'sighting',
          organizationId,
          catalogVersion: 'v1',
          epoch: 0,
          anonymous: true,
          settings: DEFAULT_SHARING,
          disclosureVersion: 1,
        },
      },
    } as unknown as Request,
    res,
  )
  return status
}

test('concurrent first grants retry the generation conflict instead of losing an update', async () => {
  const coverage = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ],
    ],
  }
  seed('catalog.json', {
    version: 'v1',
    organizations: ['first', 'second'].map((id) => ({
      id,
      name: id,
      active: true,
      coverage,
    })),
  })
  seed('submissions/owner/sighting/metadata.json', {
    submission: { latitude: 1, longitude: 1 },
    cats: [{}],
    photo_paths: [],
  })
  expect(await Promise.all([grant('first'), grant('second')])).toEqual([
    200, 200,
  ])
  const ledger = JSON.parse(
    mockObjects.get('organization-permissions/owner/ledger.json')!.text,
  ) as PermissionLedger
  expect(ledger.permissions.map((p) => p.organizationId).sort()).toEqual([
    'first',
    'second',
  ])
})
