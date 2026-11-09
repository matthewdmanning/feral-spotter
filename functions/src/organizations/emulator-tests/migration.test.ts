import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { migrateOrganizationData } from '../migration'
import {
  accountRef,
  eraseOrganizationData,
  permissionRef,
  readCatalog,
  readLedger,
  updateLedger,
} from '../store'
import { isActiveMember } from '../membership/store'
import { DEFAULT_SHARING, type Permission } from '../domain'

let app: App
const owner = 'legacy-owner'
const catalog = {
  version: 'legacy-v1',
  organizations: [
    {
      id: 'org',
      name: 'Legacy organization',
      active: true,
      coverage: {
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
      },
    },
  ],
}
const permission: Permission = {
  submissionId: 'sighting',
  organizationId: 'org',
  organizationName: 'Legacy organization',
  catalogVersion: 'legacy-v1',
  epoch: 0,
  anonymous: true,
  confirmedAt: 'legacy',
  injured: false,
  disclosureVersion: 1,
  fields: DEFAULT_SHARING.fields,
  data: {
    catCount: 1,
    generalLocation: { south: 1, north: 1.01, west: 1, east: 1.01 },
  },
}
const bucket = () => getStorage().bucket()

beforeAll(async () => {
  for (const name of [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST',
  ]) {
    const endpoint = process.env[name]
    if (
      !endpoint ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(
        new URL(`http://${endpoint}`).hostname,
      )
    )
      throw new Error(`${name} must point to a local emulator`)
  }
  app = initializeApp({
    projectId: 'demo-organization-migration',
    storageBucket: 'demo-organization-migration.firebasestorage.app',
  })
  const objects = {
    'organizations/catalog.json': catalog,
    [`organization-permissions/${owner}/ledger.json`]: {
      epochs: {},
      permissions: [permission],
      applied: ['old-grant'],
      revokedPairs: ['org/never-arrived'],
    },
    [`organization-permissions/${owner}/memberships.json`]: {
      org: {
        organizationId: 'org',
        displayName: 'Legacy member',
        status: 'active',
        requestId: 'enrollment',
      },
    },
    [`organization-invites/${'a'.repeat(64)}.json`]: { organizationId: 'org' },
  }
  for (const [path, value] of Object.entries(objects))
    await bucket().file(path).save(JSON.stringify(value), {
      resumable: false,
      contentType: 'application/json',
    })
})
afterAll(async () => {
  if (!app) return
  await bucket().deleteFiles({ prefix: '' })
  for (const collection of [
    'organizations',
    'organizationCatalog',
    'organizationAccounts',
    'organizationMemberships',
    'organizationPermissions',
    'organizationInvites',
    'organizationMigrations',
  ])
    await getFirestore().recursiveDelete(getFirestore().collection(collection))
  await deleteApp(app)
})

test('import preserves revocations and receipts, supports dry-run, and cannot resurrect erased data', async () => {
  expect(await migrateOrganizationData()).toMatchObject({
    mode: 'dry-run',
    permissions: 1,
    memberships: 1,
    invites: 1,
    receipts: 1,
  })
  expect(
    (await getFirestore().collection('organizationPermissions').get()).empty,
  ).toBe(true)
  expect(await migrateOrganizationData({ apply: true })).toMatchObject({
    mode: 'applied',
    permissions: 1,
  })
  expect(await readCatalog()).toEqual(catalog)
  expect(await isActiveMember(owner, 'org')).toBe(true)
  expect((await readLedger(owner)).value).toMatchObject({
    epochs: { org: 0 },
    permissions: [permission],
    revokedPairs: ['org/never-arrived'],
  })
  await expect(
    updateLedger(owner, 'old-grant', async () => {
      throw new Error('Replays must not rebuild the mutation')
    }),
  ).resolves.toMatchObject({ permissions: [permission] })
  await expect(
    updateLedger(owner, 'stale-new-grant', async () => ({
      type: 'grant',
      organizationId: 'org',
      permission: { ...permission, submissionId: 'never-arrived' },
    })),
  ).rejects.toMatchObject({ status: 409 })

  // A completed migration is a no-op even after subsequent account erasure.
  await eraseOrganizationData(owner)
  expect(await migrateOrganizationData({ apply: true })).toMatchObject({
    mode: 'already-complete',
  })
  expect((await permissionRef(owner, 'org', 'sighting').get()).exists).toBe(
    false,
  )
  expect((await accountRef(owner).get()).data()).toEqual({ deleting: true })
  expect(await isActiveMember(owner, 'org')).toBe(false)
})
