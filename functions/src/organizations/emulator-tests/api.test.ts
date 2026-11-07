import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { handleOrganizationsRequest } from '../api'
import {
  DEFAULT_SHARING,
  type PermissionLedger,
  type GrantRequest,
} from '../domain'

let app: App
let server: Server
let apiUrl: string
let ownerToken: string
let otherToken: string
const fixtureId = `org-emulator-${process.pid}-${Date.now()}`
const ownerUid = `${fixtureId}-owner`
const otherUid = `${fixtureId}-other`
const catalogPath = `organizations/${fixtureId}.json`
const submissionId = 'sighting'

/** Fails before initializing Admin SDK if a live endpoint could be used. */
function requireLoopback(name: string, protocol = 'http://'): string {
  const value = process.env[name]
  const url = value
    ? new URL(value.includes('://') ? value : `${protocol}${value}`)
    : null
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error(`${name} must point to a local emulator`)
  return url.origin
}
async function tokenFor(uid: string): Promise<string> {
  await getAuth().createUser({ uid, email: `${uid}@example.test` })
  const token = await getAuth().createCustomToken(uid)
  const response = await fetch(
    `${requireLoopback('FIREBASE_AUTH_EMULATOR_HOST')}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, returnSecureToken: true }),
    },
  )
  if (!response.ok) throw new Error('Emulator sign-in failed')
  return ((await response.json()) as { idToken: string }).idToken
}
async function call(body: unknown, token?: string) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    body: response.headers.get('content-type')?.includes('application/json')
      ? ((await response.json()) as PermissionLedger)
      : null,
  }
}
function grant(organizationId: string, epoch = 0): GrantRequest {
  return {
    submissionId,
    organizationId,
    catalogVersion: 'integration-v1',
    epoch,
    anonymous: true,
    settings: DEFAULT_SHARING,
    injured: false,
    disclosureVersion: 1,
  }
}
async function save(path: string, value: unknown) {
  await getStorage().bucket().file(path).save(JSON.stringify(value), {
    resumable: false,
    contentType: 'application/json',
  })
}

beforeAll(async () => {
  requireLoopback('FIREBASE_AUTH_EMULATOR_HOST')
  requireLoopback('FIREBASE_STORAGE_EMULATOR_HOST')
  if (process.env.STORAGE_EMULATOR_HOST)
    requireLoopback('STORAGE_EMULATOR_HOST')
  const projectId = process.env.GCLOUD_PROJECT
  if (!projectId) throw new Error('Run through the repository emulator runner')
  process.env.ORGANIZATIONS_CATALOG_PATH = catalogPath
  app = initializeApp({
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
  })
  ownerToken = await tokenFor(ownerUid)
  otherToken = await tokenFor(otherUid)
  await save(catalogPath, {
    version: 'integration-v1',
    organizations: ['first', 'second'].map((id) => ({
      id,
      name: `${id} rescue`,
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
    })),
  })
  await save(`submissions/${ownerUid}/${submissionId}/metadata.json`, {
    submission: { latitude: 1.00123, longitude: 1.00456, report_injured: true },
    cats: [{ health_label: 'poor' }],
    photo_paths: [`submissions/${ownerUid}/${submissionId}/cat.jpg`],
  })
  const service = express()
  service.use(express.json())
  service.post('/', (req, res, next) => {
    void handleOrganizationsRequest(req, res).catch(next)
  })
  server = await new Promise<Server>((resolve) => {
    const listening = service.listen(0, '127.0.0.1', () => resolve(listening))
  })
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
})
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  if (app) {
    await getStorage()
      .bucket()
      .file(catalogPath)
      .delete({ ignoreNotFound: true })
    for (const uid of [ownerUid, otherUid]) {
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `submissions/${uid}/` })
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `organization-permissions/${uid}/` })
      await getAuth()
        .deleteUser(uid)
        .catch(() => {})
    }
    await deleteApp(app)
  }
})

test('real HTTP, Auth and Storage preserve ownership, concurrent grants, minimization and revocation', async () => {
  expect((await call({ action: 'catalog' })).status).toBe(401)
  expect((await call({ action: 'catalog' }, 'invalid')).status).toBe(401)
  const catalog = await call({ action: 'catalog' }, ownerToken)
  expect(catalog.status).toBe(200)
  const denied = await call(
    {
      action: 'grant',
      mutationId: 'attacker',
      organizationId: 'first',
      grant: grant('first'),
    },
    otherToken,
  )
  expect(denied.status).not.toBe(200)
  const results = await Promise.all(
    ['first', 'second'].map((organizationId) =>
      call(
        {
          action: 'grant',
          mutationId: `grant-${organizationId}`,
          organizationId,
          grant: grant(organizationId),
        },
        ownerToken,
      ),
    ),
  )
  expect(results.map((result) => result.status)).toEqual([200, 200])
  const ledger = (await call({ action: 'list' }, ownerToken)).body!
  expect(ledger.permissions).toHaveLength(2)
  for (const permission of ledger.permissions) {
    expect(permission.data).toEqual({
      catCount: 1,
      generalLocation: { south: 1, west: 1, north: 1.01, east: 1.01 },
    })
    expect(permission.injured).toBe(true)
  }
  const revocation = {
    action: 'revokeOrganization',
    mutationId: 'revoke-first',
    organizationId: 'first',
  }
  expect((await call(revocation, ownerToken)).status).toBe(200)
  const repeated = (await call(revocation, ownerToken)).body!
  expect(repeated.epochs.first).toBe(1)
  expect(
    repeated.permissions.find(
      (permission) => permission.organizationId === 'first',
    )?.revokedAt,
  ).toBeDefined()
  const replay = await call(
    {
      action: 'grant',
      mutationId: 'new-stale-grant',
      organizationId: 'first',
      grant: grant('first'),
    },
    ownerToken,
  )
  expect(replay.status).toBe(409)
  expect(
    (await call({ action: 'list' }, otherToken)).body!.permissions,
  ).toEqual([])
  await getAuth().updateUser(ownerUid, { disabled: true })
  expect((await call({ action: 'list' }, ownerToken)).status).toBe(401)
})
