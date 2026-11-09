import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { handleOrganizationsRequest } from '../api'
import { membershipRef, readMemberships } from '../membership/store'
import { organizationFeatures } from '../features'
import sharp from 'sharp'
import { getFirestore, Transaction } from 'firebase-admin/firestore'
import {
  writeCatalog,
  accountRef,
  permissionRef,
  stateRef,
  currentPermission,
  eraseOrganizationData,
} from '../store'
import { createInvite, moderateMembership } from '../membership/service'
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
  requireLoopback('FIRESTORE_EMULATOR_HOST')
  app = initializeApp({
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
  })
  const service = express()
  service.use(express.json())
  service.post('/', (req, res, next) => {
    void handleOrganizationsRequest(req, res, organizationFeatures).catch(next)
  })
  server = await new Promise<Server>((resolve) => {
    const listening = service.listen(0, '127.0.0.1', () => resolve(listening))
  })
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
})
beforeEach(() => writeCatalog(catalog))
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  if (!app) return
  await getFirestore().doc('organizationCatalog/current').delete()
  for (const doc of (await getFirestore().collection('organizations').get())
    .docs)
    await doc.ref.delete()
  for (const uid of createdUids) {
    await bucket().deleteFiles({ prefix: `submissions/${uid}/` })
    await eraseOrganizationData(uid)
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
  expect(denied).toMatchObject({
    status: 404,
    body: { requiresConfirmation: false },
  })
  expect(
    (await call({ action: 'list' }, owner.token)).body!.permissions,
  ).toEqual([])
})

// Concurrency is verified against real Firestore transactions below.
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
  expect(await call(body(email), token)).toMatchObject({
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
  expect(await call(body, token)).toMatchObject({
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
  await getFirestore().doc('organizationCatalog/current').delete()
  const replay = await call(grant('first'), token)
  expect(replay.status).toBe(200)
  expect(replay.body!.permissions[0].revokedAt).toBeDefined()
})

test('a missing catalog is an empty directory', async () => {
  const { token } = await signedInUser('empty-catalog')
  await getFirestore().doc('organizationCatalog/current').delete()
  expect((await call({ action: 'catalog' }, token)).body).toEqual({
    version: 'empty-v1',
    organizations: [],
    cacheRadiusKm: 50,
  })
})

test('capacity limits reject new grants with 429 but never block revocation', async () => {
  const { uid, token } = await signedInUser('capacity')
  expect((await call(grant('first'), token)).status).toBe(200)
  await accountRef(uid).set({ mutationCount: 20000 }, { merge: true })
  expect(await call(grant('second'), token)).toMatchObject({
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
    cursor: null,
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
  await eraseOrganizationData(owner.uid)
  expect(
    (
      await call(
        { action: 'organizationMembers', organizationId: 'first' },
        owner.token,
      )
    ).status,
  ).toBe(403)
})

test('a Firestore failure after revocation leaves a resumable checkpoint without restoring grants', async () => {
  const owner = await signedInUser('member-resume')
  const code = await createInvite('first')
  await call(
    { action: 'joinOrganization', code, displayName: 'Resume member' },
    owner.token,
  )
  await moderateMembership(owner.uid, 'first', 'approve')
  await call(grant('first'), owner.token)
  // Fail only the external Firestore write ending membership; application logic stays real.
  const prototype = Transaction.prototype as unknown as {
    set: (...args: unknown[]) => unknown
  }
  const setOriginal = prototype.set
  let failed = false
  const fault = jest.spyOn(prototype, 'set').mockImplementation(function (
    this: unknown,
    ...args: unknown[]
  ) {
    const [reference, data] = args as [
      { path: string },
      { ownerUid?: string; status?: string },
    ]
    if (
      !failed &&
      reference.path.startsWith('organizationMemberships/') &&
      data.ownerUid === owner.uid &&
      data.status === 'left'
    ) {
      failed = true
      throw Object.assign(new Error('Temporary Firestore failure'), {
        code: 503,
      })
    }
    return setOriginal.apply(this, args)
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

test('shared views enforce membership, project consented fields, sanitize photos and stop after revocation', async () => {
  const owner = await signedInUser('shared-owner')
  const viewer = await signedInUser('shared-viewer')
  const code = await createInvite('first')
  await call(
    { action: 'joinOrganization', code, displayName: 'Viewer' },
    viewer.token,
  )
  expect(
    (
      await call(
        { action: 'sharedSightings', organizationId: 'first' },
        viewer.token,
      )
    ).status,
  ).toBe(403)
  await moderateMembership(viewer.uid, 'first', 'approve')
  const photoPath = `submissions/${owner.uid}/sighting/photo-0.jpg`
  const photo = await sharp({
    create: { width: 20, height: 10, channels: 3, background: 'red' },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'private' } } })
    .toBuffer()
  await bucket()
    .file(photoPath)
    .save(photo, {
      resumable: false,
      contentType: 'image/jpeg',
      metadata: { metadata: { latitude: 'private' } },
    })
  const metadataFile = bucket().file(
    `submissions/${owner.uid}/sighting/metadata.json`,
  )
  const [bytes] = await metadataFile.download()
  await save(metadataFile.name, {
    ...JSON.parse(bytes.toString()),
    photo_paths: [photoPath],
  })
  expect(
    (
      await call(
        grant('first', {
          anonymous: false,
          contactEmail: owner.email,
          settings: {
            ...DEFAULT_SHARING,
            fields: {
              ...DEFAULT_SHARING.fields,
              email: true,
              photos: true,
              catDetails: true,
            },
          },
        }),
        owner.token,
      )
    ).status,
  ).toBe(200)
  const shared: Record<string, unknown>[] = []
  let cursor: unknown
  do {
    const reply = await call(
      {
        action: 'sharedSightings',
        organizationId: 'first',
        ...(cursor ? { cursor } : {}),
      },
      viewer.token,
    )
    expect(reply.status).toBe(200)
    const page = reply.body as unknown as {
      sightings: Record<string, unknown>[]
      cursor: string | null
    }
    shared.push(...page.sightings)
    cursor = page.cursor
  } while (cursor)
  const summary = shared.find((s) => s.photoCount === 1)!
  expect(summary).toBeDefined()
  expect(summary).not.toHaveProperty('contact')
  expect(summary).not.toHaveProperty('submissionId')
  expect(summary).not.toHaveProperty('preciseLocation')
  expect(summary).toHaveProperty('cats', [{ health_label: 'poor' }])
  const imageReply = await call(
    {
      action: 'sharedPhoto',
      organizationId: 'first',
      id: summary.id,
      index: 0,
    },
    viewer.token,
  )
  expect(imageReply.status).toBe(200)
  const image = (imageReply.body as unknown as { image: string }).image
  expect(
    (await sharp(Buffer.from(image.split(',')[1], 'base64')).metadata()).exif,
  ).toBeUndefined()
  expect(image).not.toContain(photoPath)
  await call(
    {
      action: 'revoke',
      organizationId: 'first',
      submissionId: 'sighting',
      mutationId: 'revoke-delivered-photo',
    },
    owner.token,
  )
  expect(
    (
      await call(
        {
          action: 'sharedPhoto',
          organizationId: 'first',
          id: summary.id,
          index: 0,
        },
        viewer.token,
      )
    ).status,
  ).toBe(404)
  await moderateMembership(viewer.uid, 'first', 'remove')
  expect(
    (
      await call(
        { action: 'sharedSightings', organizationId: 'first' },
        viewer.token,
      )
    ).status,
  ).toBe(403)
})

test('Firestore transactions preserve concurrent grants and replay a mutation only once', async () => {
  const owner = await signedInUser('firestore-concurrency')
  const results = await Promise.all([
    call(grant('first'), owner.token),
    call(grant('second'), owner.token),
  ])
  expect(results.map((result) => result.status)).toEqual([200, 200])
  expect(
    (await call({ action: 'list' }, owner.token))
      .body!.permissions.map((permission) => permission.organizationId)
      .sort(),
  ).toEqual(['first', 'second'])
  await Promise.all([
    call(grant('first'), owner.token),
    call(grant('first'), owner.token),
  ])
  expect((await accountRef(owner.uid).get()).get('permissionCount')).toBe(2)
  expect((await accountRef(owner.uid).get()).get('mutationCount')).toBe(2)
})

test('a Firestore outage is retryable and never becomes an empty directory or a successful write', async () => {
  const owner = await signedInUser('firestore-outage')
  const outage = jest
    .spyOn(getFirestore(), 'runTransaction')
    .mockRejectedValueOnce(
      Object.assign(new Error('Unavailable'), { code: 14 }),
    )
  try {
    expect(await call({ action: 'catalog' }, owner.token)).toMatchObject({
      status: 503,
      body: { code: 'UNAVAILABLE', retryable: true },
    })
  } finally {
    outage.mockRestore()
  }
  expect((await call({ action: 'catalog' }, owner.token)).status).toBe(200)
  expect(
    (
      await getFirestore()
        .collection('organizationPermissions')
        .where('ownerUid', '==', owner.uid)
        .get()
    ).empty,
  ).toBe(true)
})

test('missing or mismatched permission metadata fails closed, and deletion guards hide names before cleanup finishes', async () => {
  const owner = await signedInUser('guarded-owner')
  const viewer = await signedInUser('guarded-viewer')
  await writeCatalog({
    ...catalog,
    organizations: [
      ...catalog.organizations,
      { ...catalog.organizations[0], id: 'guarded', name: 'Guarded rescue' },
    ],
  })
  const code = await createInvite('guarded')
  for (const [account, displayName] of [
    [owner, 'Owner name'],
    [viewer, 'Viewer name'],
  ] as const) {
    await call({ action: 'joinOrganization', code, displayName }, account.token)
    await moderateMembership(account.uid, 'guarded', 'approve')
  }
  await call(grant('guarded'), owner.token)
  const reference = permissionRef(owner.uid, 'guarded', 'sighting')
  await reference.update({ 'permission.organizationId': 'second' })
  expect(await currentPermission(reference.id, 'guarded')).toBeNull()
  expect(
    (
      await call(
        { action: 'sharedSightings', organizationId: 'guarded' },
        viewer.token,
      )
    ).body,
  ).toMatchObject({ sightings: [] })
  await reference.update({ 'permission.organizationId': 'guarded' })
  await stateRef(owner.uid, 'guarded').delete()
  expect(await currentPermission(reference.id, 'guarded')).toBeNull()
  await accountRef(owner.uid).set({ deleting: true }, { merge: true })
  expect(
    (
      await call(
        { action: 'organizationMembers', organizationId: 'guarded' },
        viewer.token,
      )
    ).body,
  ).toEqual({ members: [{ displayName: 'Viewer name' }], cursor: null })
  expect(
    (await call(grant('second', {}, 'blocked-during-erasure'), owner.token))
      .status,
  ).toBe(403)
})

test('Firestore cursors paginate organization shares and names without exposing private identifiers', async () => {
  const owner = await signedInUser('paged-owner')
  const viewer = await signedInUser('paged-viewer')
  const organizationId = 'paged'
  await writeCatalog({
    ...catalog,
    organizations: [
      ...catalog.organizations,
      { ...catalog.organizations[0], id: organizationId, name: 'Paged rescue' },
    ],
  })
  const code = await createInvite(organizationId)
  await call(
    { action: 'joinOrganization', code, displayName: 'Viewer' },
    viewer.token,
  )
  await moderateMembership(viewer.uid, organizationId, 'approve')
  await call(grant(organizationId), owner.token)
  const permission = (await call({ action: 'list' }, owner.token)).body!
    .permissions[0]
  const batch = getFirestore().batch()
  for (let index = 0; index < 50; index++) {
    const submissionId = `page-${index}`
    batch.set(permissionRef(owner.uid, organizationId, submissionId), {
      ownerUid: owner.uid,
      organizationId,
      submissionId,
      permission: { ...permission, submissionId },
    })
  }
  batch.set(accountRef(owner.uid), { permissionCount: 51 }, { merge: true })
  const memberUids = Array.from(
    { length: 100 },
    (_, index) => `${fixtureId}-paged-${index}`,
  )
  for (const [index, uid] of memberUids.entries()) {
    batch.set(accountRef(uid), { permissionCount: 0, mutationCount: 0 })
    batch.set(membershipRef(uid, organizationId), {
      ownerUid: uid,
      organizationId,
      displayName: `Member ${index}`,
      status: 'active',
    })
  }
  await batch.commit()
  try {
    const first = (
      await call({ action: 'sharedSightings', organizationId }, viewer.token)
    ).body as unknown as { sightings: { id: string }[]; cursor: string }
    expect(first.sightings).toHaveLength(50)
    expect(first.cursor).toMatch(/^[a-f0-9]{64}$/)
    const second = (
      await call(
        { action: 'sharedSightings', organizationId, cursor: first.cursor },
        viewer.token,
      )
    ).body as unknown as { sightings: { id: string }[]; cursor: null }
    expect(second.sightings).toHaveLength(1)
    expect(
      new Set([...first.sightings, ...second.sightings].map((item) => item.id))
        .size,
    ).toBe(51)
    expect(second.cursor).toBeNull()
    const names = (
      await call(
        { action: 'organizationMembers', organizationId },
        viewer.token,
      )
    ).body as unknown as { members: { displayName: string }[]; cursor: string }
    expect(names.members).toHaveLength(100)
    const more = (
      await call(
        { action: 'organizationMembers', organizationId, cursor: names.cursor },
        viewer.token,
      )
    ).body as unknown as { members: { displayName: string }[]; cursor: null }
    expect(more.members).toHaveLength(1)
    expect(more.cursor).toBeNull()
    for (const member of [...names.members, ...more.members])
      expect(Object.keys(member)).toEqual(['displayName'])
  } finally {
    const cleanup = getFirestore().batch()
    for (const uid of memberUids) {
      cleanup.delete(accountRef(uid))
      cleanup.delete(membershipRef(uid, organizationId))
    }
    await cleanup.commit()
  }
})
