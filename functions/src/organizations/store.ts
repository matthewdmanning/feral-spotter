import { createHash } from 'node:crypto'
import {
  FieldPath,
  getFirestore,
  type Transaction,
} from 'firebase-admin/firestore'
import { mutateLedger, type LedgerMutation } from './ledger'
import {
  parseCatalog,
  type Catalog,
  type Permission,
  type PermissionLedger,
} from './domain'
import { RequestError } from './errors'

export const db = () => getFirestore()
export const accountRef = (uid: string) =>
  db().collection('organizationAccounts').doc(uid)
export const permissionId = (
  uid: string,
  organizationId: string,
  submissionId: string,
) =>
  createHash('sha256')
    .update(`${uid}/${organizationId}/${submissionId}`)
    .digest('hex')
export const permissionRef = (
  uid: string,
  organizationId: string,
  submissionId: string,
) =>
  db()
    .collection('organizationPermissions')
    .doc(permissionId(uid, organizationId, submissionId))
export const stateRef = (uid: string, organizationId: string) =>
  accountRef(uid).collection('states').doc(organizationId)
export const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export interface OrganizationAccount {
  deleting?: boolean
  permissionCount?: number
  mutationCount?: number
}
export interface PermissionState {
  epoch?: number
  blockedToken?: string | null
  revokedThroughEpoch?: number
  revokedAt?: string
}
export interface StoredPermission {
  ownerUid: string
  organizationId: string
  submissionId: string
  permission?: Permission
  revokedAt?: string
}

export async function checkedAccount(
  transaction: Transaction,
  uid: string,
): Promise<OrganizationAccount> {
  const account = (await transaction.get(accountRef(uid))).data() as
    OrganizationAccount | undefined
  if (account?.deleting)
    throw new RequestError(403, 'Account deletion is in progress')
  return account ?? {}
}

export async function readCatalog(): Promise<Catalog> {
  return db().runTransaction(
    async (transaction) => {
      const metadata = await transaction.get(
        db().doc('organizationCatalog/current'),
      )
      if (!metadata.exists) return { version: 'empty-v1', organizations: [] }
      if (metadata.get('updating'))
        throw new RequestError(
          503,
          'The organization directory is updating. Please retry.',
        )
      const organizations = await transaction.get(
        db().collection('organizations'),
      )
      return parseCatalog({
        version: metadata.get('version'),
        organizations: organizations.docs.map((doc) => {
          const record = doc.data()
          return {
            id: doc.id,
            name: record.name,
            active: record.active,
            coverage: JSON.parse(record.coverageJson),
          }
        }),
      })
    },
    { readOnly: true },
  )
}

/** A generation boundary makes organization-wide revocation constant-time and authoritative. */
export function effectivePermission(
  record: StoredPermission,
  state: PermissionState,
  account?: OrganizationAccount,
): Permission | undefined {
  const permission = record.permission
  if (!permission) return undefined
  const revokedAt =
    record.revokedAt ??
    permission.revokedAt ??
    ((state.revokedThroughEpoch ?? -1) >= permission.epoch
      ? state.revokedAt
      : undefined) ??
    (account?.deleting ? new Date().toISOString() : undefined)
  return revokedAt ? { ...permission, revokedAt } : permission
}

export async function readLedger(
  uid: string,
): Promise<{ value: PermissionLedger; generation: number }> {
  return db().runTransaction(
    async (transaction) => {
      const [account, states, records] = await Promise.all([
        transaction.get(accountRef(uid)),
        transaction.get(accountRef(uid).collection('states')),
        transaction.get(
          db()
            .collection('organizationPermissions')
            .where('ownerUid', '==', uid),
        ),
      ])
      const stateMap = new Map(
        states.docs.map((doc) => [doc.id, doc.data() as PermissionState]),
      )
      const permissions: Permission[] = []
      const revokedPairs: string[] = []
      for (const doc of records.docs) {
        const record = doc.data() as StoredPermission
        const permission = effectivePermission(
          record,
          stateMap.get(record.organizationId) ?? {},
          account.data(),
        )
        if (permission) permissions.push(permission)
        else if (record.revokedAt)
          revokedPairs.push(`${record.organizationId}/${record.submissionId}`)
      }
      return {
        generation: 0,
        value: {
          permissions,
          revokedPairs,
          epochs: Object.fromEntries(
            states.docs.map((doc) => [doc.id, doc.get('epoch') ?? 0]),
          ),
          blockedOrganizations: Object.fromEntries(
            states.docs
              .filter((doc) => doc.get('blockedToken'))
              .map((doc) => [doc.id, doc.get('blockedToken')]),
          ),
        },
      }
    },
    { readOnly: true },
  )
}

/** Mutation receipts and permission writes commit together; Firestore retries contention. */
export async function updateLedger(
  uid: string,
  mutationId: string,
  build: () => Promise<LedgerMutation>,
): Promise<PermissionLedger> {
  const marker = accountRef(uid)
    .collection('mutations')
    .doc(createHash('sha256').update(mutationId).digest('hex'))
  if ((await marker.get()).exists) return (await readLedger(uid)).value
  // Auth/Storage work is performed once, outside Firestore's retrying callback.
  const mutation = await build()
  if (
    mutation.type === 'replaceOrganization' &&
    (mutation.permissions.length > 400 ||
      Buffer.byteLength(JSON.stringify(mutation.permissions)) > 8 * 1024 * 1024)
  )
    throw new RequestError(
      429,
      'Too many retained shares; leave and unshare instead',
    )
  await db().runTransaction(async (transaction) => {
    const receipt = await transaction.get(marker)
    if (receipt.exists) return
    const account = await checkedAccount(transaction, uid)
    const scope = stateRef(uid, mutation.organizationId)
    const state =
      ((await transaction.get(scope)).data() as PermissionState | undefined) ??
      {}
    const now = new Date().toISOString()
    const base: PermissionLedger = {
      epochs: { [mutation.organizationId]: state.epoch ?? 0 },
      blockedOrganizations: state.blockedToken
        ? { [mutation.organizationId]: state.blockedToken }
        : {},
      permissions: [],
      revokedPairs: [],
    }
    let target: FirebaseFirestore.DocumentReference | undefined
    let existing: StoredPermission | undefined
    if (mutation.type === 'grant' || mutation.type === 'revoke') {
      const submissionId =
        mutation.type === 'grant'
          ? mutation.permission.submissionId
          : mutation.submissionId
      target = permissionRef(uid, mutation.organizationId, submissionId)
      existing = (await transaction.get(target)).data() as
        StoredPermission | undefined
      if (existing) {
        const permission = effectivePermission(existing, state)
        if (permission) base.permissions.push(permission)
        else if (existing.revokedAt)
          base.revokedPairs!.push(`${mutation.organizationId}/${submissionId}`)
      }
    }
    let replacements: FirebaseFirestore.QuerySnapshot | undefined
    if (mutation.type === 'replaceOrganization') {
      replacements = await transaction.get(
        db()
          .collection('organizationPermissions')
          .where('ownerUid', '==', uid)
          .where('organizationId', '==', mutation.organizationId)
          .limit(401),
      )
      if (replacements.size > 400)
        throw new RequestError(
          429,
          'Too many retained shares; leave and unshare instead',
        )
      base.permissions = replacements.docs.flatMap((doc) => {
        const permission = effectivePermission(
          doc.data() as StoredPermission,
          state,
        )
        return permission ? [permission] : []
      })
    }
    const next = mutateLedger(base, mutation, now)
    const newGrant = mutation.type === 'grant' && !existing?.permission
    if (
      mutation.type === 'grant' &&
      ((account.permissionCount ?? 0) + Number(newGrant) > 5000 ||
        (account.mutationCount ?? 0) >= 20000)
    )
      throw new RequestError(429, 'Permission limit reached')
    if (mutation.type === 'grant' && newGrant && target)
      transaction.set(
        target,
        clean({
          ownerUid: uid,
          organizationId: mutation.organizationId,
          submissionId: mutation.permission.submissionId,
          permission: mutation.permission,
        }),
      )
    if (mutation.type === 'revoke' && target)
      transaction.set(
        target,
        clean({
          ...existing,
          ownerUid: uid,
          organizationId: mutation.organizationId,
          submissionId: mutation.submissionId,
          revokedAt: existing?.revokedAt ?? now,
        }),
      )
    if (replacements)
      for (const doc of replacements.docs) {
        const record = doc.data() as StoredPermission
        const permission = next.permissions.find(
          (p) => p.submissionId === record.submissionId,
        )
        if (permission && !permission.revokedAt)
          transaction.update(doc.ref, { permission: clean(permission) })
      }
    transaction.set(
      scope,
      clean({
        ...state,
        epoch: next.epochs[mutation.organizationId] ?? 0,
        blockedToken:
          next.blockedOrganizations?.[mutation.organizationId] ?? null,
        ...(mutation.type === 'revokeOrganization'
          ? { revokedThroughEpoch: state.epoch ?? 0, revokedAt: now }
          : {}),
      }),
    )
    transaction.set(accountRef(uid), {
      ...account,
      permissionCount: (account.permissionCount ?? 0) + Number(newGrant),
      mutationCount: (account.mutationCount ?? 0) + 1,
    })
    transaction.create(marker, { appliedAt: now })
  })
  return (await readLedger(uid)).value
}

export async function currentPermission(
  id: string,
  organizationId: string,
): Promise<{ uid: string; permission: Permission } | null> {
  return db().runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(
        db().collection('organizationPermissions').doc(id),
      )
      const record = snapshot.data() as StoredPermission | undefined
      if (!record || record.organizationId !== organizationId) return null
      const [scope, account] = await Promise.all([
        transaction.get(stateRef(record.ownerUid, organizationId)),
        transaction.get(accountRef(record.ownerUid)),
      ])
      const state = (scope.data() as PermissionState | undefined) ?? {}
      const permission = effectivePermission(record, state, account.data())
      return permission && !permission.revokedAt && !state.blockedToken
        ? { uid: record.ownerUid, permission }
        : null
    },
    { readOnly: true },
  )
}

export async function sharedPermissionPage(
  organizationId: string,
  cursor?: string,
) {
  if (cursor !== undefined && !/^[a-f0-9]{64}$/.test(cursor))
    throw new RequestError(400, 'Invalid cursor')
  let query = db()
    .collection('organizationPermissions')
    .where('organizationId', '==', organizationId)
    .orderBy(FieldPath.documentId())
    .limit(50)
  if (cursor) query = query.startAfter(cursor)
  const page = await query.get()
  const permissions = await Promise.all(
    page.docs.map((doc) => currentPermission(doc.id, organizationId)),
  )
  return {
    permissions: permissions.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    ),
    cursor: page.size === 50 ? page.docs[page.docs.length - 1].id : null,
  }
}

/** Block new writes before deleting names, permissions, receipts, and transition state. */
export async function eraseOrganizationData(uid: string) {
  await accountRef(uid).set({ deleting: true }, { merge: true })
  for (const collection of [
    'organizationPermissions',
    'organizationMemberships',
  ]) {
    const docs = await db()
      .collection(collection)
      .where('ownerUid', '==', uid)
      .get()
    const writer = db().bulkWriter()
    const deleted = docs.docs.map((doc) => writer.delete(doc.ref))
    await writer.close()
    await Promise.all(deleted)
  }
  for (const collection of ['states', 'mutations'])
    await db().recursiveDelete(accountRef(uid).collection(collection))
  // Keep only a write-denial tombstone; it contains no names, contacts or Sightings.
  await accountRef(uid).set({ deleting: true })
}

/** Recoverable catalog publication; readers never consume a partially updated directory. */
export async function writeCatalog(input: Catalog) {
  const catalog = parseCatalog(input)
  const token = createHash('sha256')
    .update(JSON.stringify(catalog))
    .digest('hex')
  const metadata = db().doc('organizationCatalog/current')
  await db().runTransaction(async (transaction) => {
    const previous = await transaction.get(metadata)
    if (previous.get('updating') && previous.get('updateToken') !== token)
      throw RequestError.confirmAgain('Another directory update is in progress')
    transaction.set(metadata, {
      version: previous.get('version') ?? catalog.version,
      updating: true,
      updateToken: token,
    })
  })
  const existing = await db().collection('organizations').get()
  const ids = new Set(
    catalog.organizations.map((organization) => organization.id),
  )
  // Batches keep publication below Firestore's per-commit write limits.
  const writes: (() => FirebaseFirestore.WriteBatch)[] = []
  for (
    let start = 0;
    start < Math.max(catalog.organizations.length, existing.size);
    start += 200
  ) {
    writes.push(() => {
      const batch = db().batch()
      for (const organization of catalog.organizations.slice(
        start,
        start + 200,
      ))
        batch.set(db().collection('organizations').doc(organization.id), {
          name: organization.name,
          active: organization.active,
          coverageJson: JSON.stringify(organization.coverage),
        })
      for (const doc of existing.docs.slice(start, start + 200))
        if (!ids.has(doc.id)) batch.delete(doc.ref)
      return batch
    })
  }
  for (const batch of writes) await batch().commit()
  await db().runTransaction(async (transaction) => {
    if ((await transaction.get(metadata)).get('updateToken') !== token)
      throw RequestError.confirmAgain('Directory update changed')
    transaction.set(metadata, { version: catalog.version, updating: false })
  })
}
