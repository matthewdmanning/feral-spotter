import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { handleOrganizationsRequest } from '../api'
import { membershipExtension } from '../membership/api'
import {
  createInvite,
  moderateMembership,
  readMemberships,
} from '../membership/service'
import {
  DEFAULT_SHARING,
  type Catalog,
  type GrantRequest,
  type PermissionLedger,
} from '../domain'

let app: App
let server: Server
let apiUrl: string
const fixtureId = `org-emulator-${process.pid}-${Date.now()}`
const catalogPath = `organizations/${fixtureId}.json`
const createdUids: string[] = []
const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ] as [number, number][],
  ],
}
const catalog: Catalog = {
  version: 'integration-v1',
  organizations: ['first', 'second'].map((id) => ({
    id,
    name: `${id} rescue`,
    active: true,
    coverage: square,
  })),
}

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
const bucket = () => getStorage().bucket()
async function save(path: string, value: unknown) {
  await bucket().file(path).save(JSON.stringify(value), {
    resumable: false,
    contentType: 'application/json',
  })
}
/** A real emulator account with one submitted sighting at the given point. */
async function signedInUser(
  label: string,
  sighting = { latitude: 1.00123, longitude: 1.00456 },
) {
  const uid = `${fixtureId}-${label}-${createdUids.length}`
  createdUids.push(uid)
  await getAuth().createUser({ uid, email: `${uid}@example.test` })
  const response = await fetch(
    `${requireLoopback('FIREBASE_AUTH_EMULATOR_HOST')}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: await getAuth().createCustomToken(uid),
        returnSecureToken: true,
      }),
    },
  )
  if (!response.ok) throw new Error('Emulator sign-in failed')
  await save(`submissions/${uid}/sighting/metadata.json`, {
    submission: { ...sighting, report_injured: true },
    cats: [{ health_label: 'poor', local_id: 'internal' }],
    photo_paths: [`submissions/${uid}/sighting/cat.jpg`],
  })
  const { idToken } = (await response.json()) as { idToken: string }
  return { uid, email: `${uid}@example.test`, token: idToken }
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
      ? ((await response.json()) as PermissionLedger & {
          requiresConfirmation?: boolean
        })
      : null,
  }
}
function grant(
  organizationId: string,
  overrides: Partial<GrantRequest> = {},
  mutationId = `grant-${organizationId}`,
) {
  return {
    action: 'grant',
    mutationId,
    organizationId,
    grant: {
      submissionId: 'sighting',
      organizationId,
      catalogVersion: catalog.version,
      epoch: 0,
      anonymous: true,
      settings: DEFAULT_SHARING,
      disclosureVersion: 1,
      ...overrides,
    },
  }
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
  const service = express()
  service.use(express.json())
  service.post('/', (req, res, next) => {
    void handleOrganizationsRequest(req, res, membershipExtension).catch(next)
  })
  server = await new Promise<Server>((resolve) => {
    const listening = service.listen(0, '127.0.0.1', () => resolve(listening))
  })
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
})
beforeEach(() => save(catalogPath, catalog))
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  if (!app) return
  await bucket().file(catalogPath).delete({ ignoreNotFound: true })
  for (const uid of createdUids) {
    await bucket().deleteFiles({ prefix: `submissions/${uid}/` })
    await bucket().deleteFiles({ prefix: `organization-permissions/${uid}/` })
    await getAuth()
      .deleteUser(uid)
      .catch(() => {})
  }
  await deleteApp(app)
})

test('missing, invalid and disabled accounts are unauthenticated', async () => {
  const { uid, token } = await signedInUser('disabled')
  expect((await call({ action: 'catalog' })).status).toBe(401)
  expect((await call({ action: 'catalog' }, 'invalid')).status).toBe(401)
  expect((await call({ action: 'catalog' }, token)).status).toBe(200)
  await getAuth().updateUser(uid, { disabled: true })
  expect((await call({ action: 'list' }, token)).status).toBe(401)
})

test('a user cannot grant access to another user’s sighting', async () => {
  const owner = await signedInUser('owner')
  const attacker = await signedInUser('attacker')
  await bucket().deleteFiles({ prefix: `submissions/${attacker.uid}/` })
  const denied = await call(grant('first'), attacker.token)
  expect(denied).toEqual({ status: 404, body: { requiresConfirmation: false } })
  expect(
    (await call({ action: 'list' }, owner.token)).body!.permissions,
  ).toEqual([])
})

// Concurrency lives in __tests__/ledgerConcurrency: this emulator ignores generation preconditions.
test('overlapping grants are minimized, with injury derived from the stored sighting', async () => {
  const { token } = await signedInUser('overlapping')
  for (const id of ['first', 'second']) {
    const result = await call(
      grant(id, {
        settings: {
          fields: { ...DEFAULT_SHARING.fields, name: true, phone: true },
          name: 'Private',
          phone: '123',
        },
      }),
      token,
    )
    expect(result.status).toBe(200)
  }
  const { permissions } = (await call({ action: 'list' }, token)).body!
  expect(permissions).toHaveLength(2)
  for (const permission of permissions) {
    expect(permission.fields).toMatchObject({ name: false, phone: false })
    expect(permission.injured).toBe(true)
    expect(permission.data).toEqual({
      catCount: 1,
      generalLocation: { south: 1, west: 1, north: 1.01, east: 1.01 },
    })
  }
})

test.each<[string, (email: string) => ReturnType<typeof grant>]>([
  ['a changed catalog', () => grant('first', { catalogVersion: 'old' })],
  [
    'a changed account email',
    () =>
      grant('first', {
        anonymous: false,
        contactEmail: 'old@example.test',
        settings: {
          ...DEFAULT_SHARING,
          fields: { ...DEFAULT_SHARING.fields, email: true },
        },
      }),
  ],
  ['an inactive organization', () => grant('missing-org')],
])('%s requires confirming again', async (_name, body) => {
  const { email, token } = await signedInUser('stale')
  expect(await call(body(email), token)).toEqual({
    status: 409,
    body: { requiresConfirmation: true },
  })
})

test('a sighting outside coverage requires confirming again', async () => {
  const { token } = await signedInUser('outside', { latitude: 8, longitude: 8 })
  expect((await call(grant('first'), token)).status).toBe(409)
})

test.each<[string, unknown]>([
  ['an invalid grant', { ...grant('first'), grant: { submissionId: 'x' } }],
  ['mismatched organizations', { ...grant('first'), organizationId: 'second' }],
  [
    'an unknown action',
    { action: 'share', mutationId: 'm', organizationId: 'first' },
  ],
  ['an invalid mutation ID', { ...grant('first'), mutationId: '../x' }],
])('%s is a permanent 400, never a retryable 503', async (_name, body) => {
  const { token } = await signedInUser('invalid')
  expect(await call(body, token)).toEqual({
    status: 400,
    body: { requiresConfirmation: false },
  })
})

test('revocations are idempotent, block stale grants, and replay acknowledged mutations', async () => {
  const { token } = await signedInUser('revocation')
  expect((await call(grant('first'), token)).status).toBe(200)
  const revocation = {
    action: 'revokeOrganization',
    mutationId: 'revoke-first',
    organizationId: 'first',
  }
  expect((await call(revocation, token)).status).toBe(200)
  const repeated = (await call(revocation, token)).body!
  expect(repeated.epochs.first).toBe(1)
  expect(repeated.permissions[0].revokedAt).toBeDefined()
  expect(
    (await call(grant('first', {}, 'new-stale-grant'), token)).status,
  ).toBe(409)
  await bucket().file(catalogPath).delete()
  const replay = await call(grant('first'), token)
  expect(replay.status).toBe(200)
  expect(replay.body!.permissions[0].revokedAt).toBeDefined()
})

test('a missing catalog is an empty directory', async () => {
  const { token } = await signedInUser('empty-catalog')
  await bucket().file(catalogPath).delete()
  expect((await call({ action: 'catalog' }, token)).body).toEqual({
    version: 'empty-v1',
    organizations: [],
    cacheRadiusKm: 50,
  })
})

test('capacity limits reject new grants with 429 but never block revocation', async () => {
  const { uid, token } = await signedInUser('capacity')
  expect((await call(grant('first'), token)).status).toBe(200)
  const path = `organization-permissions/${uid}/ledger.json`
  const [bytes] = await bucket().file(path).download()
  await save(path, {
    ...JSON.parse(bytes.toString()),
    applied: Array.from({ length: 20000 }, (_, i) => `operation-${i}`),
  })
  expect(await call(grant('second'), token)).toEqual({
    status: 429,
    body: { requiresConfirmation: false },
  })
  const revoke = await call(
    {
      action: 'revoke',
      organizationId: 'first',
      submissionId: 'sighting',
      mutationId: 'revoke-at-limit',
    },
    token,
  )
  expect(revoke.status).toBe(200)
  expect(revoke.body!.permissions[0].revokedAt).toBeDefined()
})

test('membership approval, private roster, default leaving and stale-grant rejection', async () => {
  const owner = await signedInUser('member-owner')
  const outsider = await signedInUser('member-outsider')
  const code = await createInvite('first')
  expect(
    (
      await call(
        { action: 'joinOrganization', code, displayName: '   ' },
        owner.token,
      )
    ).status,
  ).toBe(400)
  expect(
    (
      await call(
        { action: 'joinOrganization', code, displayName: '  Visible name  ' },
        owner.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await call(
        { action: 'organizationMembers', organizationId: 'first' },
        owner.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await call(
        { action: 'approveMembership', organizationId: 'first' },
        owner.token,
      )
    ).status,
  ).toBe(400)
  await moderateMembership(owner.uid, 'first', 'approve')
  const rosterReply = await call(
    { action: 'organizationMembers', organizationId: 'first' },
    owner.token,
  )
  expect(rosterReply.status).toBe(200)
  expect(rosterReply.body).toEqual({
    members: [{ displayName: 'Visible name' }],
  })
  expect(
    (
      await call(
        { action: 'organizationMembers', organizationId: 'first' },
        outsider.token,
      )
    ).status,
  ).toBe(403)
  expect((await call(grant('first'), owner.token)).status).toBe(200)
  expect((await call(grant('second'), owner.token)).status).toBe(200)
  const leave = {
    action: 'leaveOrganization',
    organizationId: 'first',
    choice: { mode: 'revoke', mutationId: 'leave-default' },
  }
  expect((await call(leave, owner.token)).status).toBe(200)
  expect((await call(leave, owner.token)).status).toBe(200)
  const ledger = (await call({ action: 'list' }, owner.token)).body!
  expect(
    ledger.permissions.find((p) => p.organizationId === 'first')?.revokedAt,
  ).toBeDefined()
  expect(
    ledger.permissions.find((p) => p.organizationId === 'second')?.revokedAt,
  ).toBeUndefined()
  expect(
    (await call(grant('first', {}, 'stale-after-leave'), owner.token)).status,
  ).toBe(409)
  expect((await readMemberships(owner.uid)).first.status).toBe('left')
  expect(
    (
      await call(
        { action: 'organizationMembers', organizationId: 'first' },
        owner.token,
      )
    ).status,
  ).toBe(403)
})

test('keeping shares replaces field permissions; invalid review preserves membership; removal revokes retained content', async () => {
  const owner = await signedInUser('member-keep')
  const code = await createInvite('second')
  await call(
    { action: 'joinOrganization', code, displayName: 'Keep member' },
    owner.token,
  )
  await moderateMembership(owner.uid, 'second', 'approve')
  await call(
    grant('second', {
      anonymous: false,
      contactEmail: owner.email,
      settings: {
        ...DEFAULT_SHARING,
        fields: { ...DEFAULT_SHARING.fields, email: true, catDetails: true },
      },
    }),
    owner.token,
  )
  const bad = {
    mode: 'keep',
    mutationId: 'bad-review',
    epoch: 0,
    catalogVersion: 'stale',
    anonymous: true,
    settings: DEFAULT_SHARING,
  }
  expect(
    (
      await call(
        { action: 'leaveOrganization', organizationId: 'second', choice: bad },
        owner.token,
      )
    ).status,
  ).toBe(409)
  expect((await readMemberships(owner.uid)).second).toMatchObject({
    status: 'active',
  })
  expect((await readMemberships(owner.uid)).second.exit).toBeUndefined()
  const choice = {
    ...bad,
    mutationId: 'good-review',
    catalogVersion: catalog.version,
  }
  expect(
    (
      await call(
        { action: 'leaveOrganization', organizationId: 'second', choice },
        owner.token,
      )
    ).status,
  ).toBe(200)
  const ledger = (await call({ action: 'list' }, owner.token)).body!
  const retained = ledger.permissions.find(
    (p) => p.organizationId === 'second',
  )!
  expect(retained.revokedAt).toBeUndefined()
  expect(retained.data.contact).toBeUndefined()
  expect(retained.data.cats).toBeUndefined()
  expect(ledger.epochs.second).toBe(1)
  await moderateMembership(owner.uid, 'second', 'remove')
  expect(
    (await call({ action: 'list' }, owner.token)).body!.permissions.find(
      (p) => p.organizationId === 'second',
    )?.revokedAt,
  ).toBeDefined()
})

test('a repeated leave ID after rejoining cannot bypass unsharing, and account erasure removes roster names', async () => {
  const owner = await signedInUser('member-rejoin')
  const code = await createInvite('first')
  const join = () =>
    call(
      { action: 'joinOrganization', code, displayName: 'Rejoined member' },
      owner.token,
    )
  const leave = () =>
    call(
      {
        action: 'leaveOrganization',
        organizationId: 'first',
        choice: { mode: 'revoke', mutationId: 'reused-leave-id' },
      },
      owner.token,
    )
  await join()
  await moderateMembership(owner.uid, 'first', 'approve')
  await leave()
  await join()
  await moderateMembership(owner.uid, 'first', 'approve')
  // A different Submission can be explicitly shared after leaving; joining did not restore anything.
  const source = `submissions/${owner.uid}/sighting/metadata.json`
  const [bytes] = await bucket().file(source).download()
  const data = JSON.parse(bytes.toString())
  data.photo_paths = []
  await save(`submissions/${owner.uid}/new-sighting/metadata.json`, data)
  expect(
    (
      await call(
        grant(
          'first',
          { epoch: 1, submissionId: 'new-sighting' },
          'new-explicit-share',
        ),
        owner.token,
      )
    ).status,
  ).toBe(200)
  expect((await leave()).status).toBe(200)
  const ledger = (await call({ action: 'list' }, owner.token)).body!
  expect(ledger.permissions.every((p) => p.revokedAt)).toBe(true)
  await join()
  await moderateMembership(owner.uid, 'first', 'approve')
  await bucket().deleteFiles({
    prefix: `organization-permissions/${owner.uid}/`,
  })
  expect(
    (
      await call(
        { action: 'organizationMembers', organizationId: 'first' },
        owner.token,
      )
    ).status,
  ).toBe(403)
})

test('a Storage failure after revocation leaves a resumable checkpoint without restoring grants', async () => {
  const owner = await signedInUser('member-resume')
  const code = await createInvite('first')
  await call(
    { action: 'joinOrganization', code, displayName: 'Resume member' },
    owner.token,
  )
  await moderateMembership(owner.uid, 'first', 'approve')
  await call(grant('first'), owner.token)
  // Fail only the external Storage write ending membership; all application logic stays real.
  const prototype = Object.getPrototypeOf(bucket().file('probe')) as {
    save: (this: { name: string }, ...args: unknown[]) => Promise<void>
  }
  const saveOriginal = prototype.save
  let failed = false
  const fault = jest.spyOn(prototype, 'save').mockImplementation(function (
    this: { name: string },
    ...args: unknown[]
  ) {
    if (
      !failed &&
      this.name === `organization-permissions/${owner.uid}/memberships.json` &&
      String(args[0]).includes('"status":"left"')
    ) {
      failed = true
      return Promise.reject(
        Object.assign(new Error('Temporary Storage failure'), { code: 503 }),
      )
    }
    return saveOriginal.apply(this, args)
  })
  try {
    const response = await call(
      {
        action: 'leaveOrganization',
        organizationId: 'first',
        choice: { mode: 'revoke', mutationId: 'resume-leave' },
      },
      owner.token,
    )
    expect(response.status).toBe(503)
    expect((await readMemberships(owner.uid)).first).toMatchObject({
      status: 'active',
      exit: { mutationId: 'resume-leave' },
    })
    expect(
      (await call(grant('first', {}, 'blocked-during-exit'), owner.token))
        .status,
    ).toBe(409)
    expect(
      (
        await call(
          { action: 'resumeLeaving', organizationId: 'first' },
          owner.token,
        )
      ).status,
    ).toBe(200)
    expect((await readMemberships(owner.uid)).first).toMatchObject({
      status: 'left',
    })
    expect((await readMemberships(owner.uid)).first.exit).toBeUndefined()
  } finally {
    fault.mockRestore()
  }
})
