import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { membershipRef } from '../membership/store'
import {
  writeCatalog,
  accountRef,
  permissionRef,
  stateRef,
  currentPermission,
  eraseOrganizationData,
} from '../store'
import { createInvite, moderateMembership } from '../membership/service'
import { DEFAULT_SHARING } from '../domain'
import {
  bucket,
  call,
  catalog,
  createOrganizations,
  fixtureId,
  grant,
  save,
  signedInUser,
  serveEmulatorApi,
} from './harness'

serveEmulatorApi()

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

test('joining requires a display name, members cannot approve themselves, and the roster shows display names only', async () => {
  const [organizationId] = await createOrganizations(1)
  const owner = await signedInUser('member-owner')
  const code = await createInvite(organizationId)
  const join = (displayName: string) =>
    call({ action: 'joinOrganization', code, displayName }, owner.token)
  expect((await join('   ')).status).toBe(400)
  expect((await join('  Visible name  ')).status).toBe(200)
  // There is no member-facing approval API; only operators approve.
  expect(
    (await call({ action: 'approveMembership', organizationId }, owner.token))
      .status,
  ).toBe(400)
  await moderateMembership(owner.uid, organizationId, 'approve')
  expect(
    await call({ action: 'organizationMembers', organizationId }, owner.token),
  ).toEqual({
    status: 200,
    body: { members: [{ displayName: 'Visible name' }], cursor: null },
  })
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
