import { createHash } from 'node:crypto'
import type { GetFilesResponse } from '@google-cloud/storage'
import { getStorage } from 'firebase-admin/storage'
import {
  accountRef,
  clean,
  db,
  permissionId,
  permissionRef,
  stateRef,
  writeCatalog,
} from './store'
import { errorCode } from './errors'
import { parseCatalog, type Catalog, type PermissionLedger } from './domain'
import type { Membership } from './membership/domain'

interface LegacyLedger extends PermissionLedger {
  applied?: string[]
}

/** Explicit offline import. Runtime reads never silently fall back to Storage. */
export async function migrateOrganizationData({
  apply = false,
  catalogPath = 'organizations/catalog.json',
}: { apply?: boolean; catalogPath?: string } = {}) {
  const bucket = getStorage().bucket()
  const progress = db().doc('organizationMigrations/storage-v1')
  if (apply) {
    const completed = await db().runTransaction(async (transaction) => {
      const existing = await transaction.get(progress)
      if (existing.exists) {
        if (
          existing.get('bucket') !== bucket.name ||
          existing.get('catalogPath') !== catalogPath
        )
          throw new Error('Migration source differs from the saved checkpoint')
        return existing.get('status') === 'complete'
          ? (existing.get('counts') as Record<string, number>)
          : undefined
      }
      const [permissions, memberships, directory] = await Promise.all([
        transaction.get(db().collection('organizationPermissions').limit(1)),
        transaction.get(db().collection('organizationMemberships').limit(1)),
        transaction.get(db().doc('organizationCatalog/current')),
      ])
      if (!permissions.empty || !memberships.empty || directory.exists)
        throw new Error(
          'Target organization database must be empty before the first import',
        )
      transaction.create(progress, {
        bucket: bucket.name,
        catalogPath,
        status: 'importing',
      })
    })
    if (completed) return { mode: 'already-complete', ...completed }
  }
  let catalog: Catalog | undefined
  try {
    const [bytes] = await bucket.file(catalogPath).download()
    catalog = parseCatalog(JSON.parse(bytes.toString()))
    if (
      catalog.organizations.some(
        (organization) =>
          Buffer.byteLength(JSON.stringify(organization)) > 900 * 1024,
      )
    )
      throw new Error(
        'Organization coverage exceeds the Firestore document limit',
      )
  } catch (error) {
    if (errorCode(error) !== 404) throw error
  }
  const counts = { permissions: 0, memberships: 0, invites: 0, receipts: 0 }
  const writer = apply
    ? db().bulkWriter({
        throttling: { initialOpsPerSecond: 100, maxOpsPerSecond: 300 },
      })
    : null
  let pending: Promise<{ error?: unknown }>[] = []
  const flush = async () => {
    await writer?.flush()
    const results = await Promise.all(pending)
    pending = []
    const failed = results.find((result) => result.error)
    if (failed) throw failed.error
  }
  const put = async (
    reference: FirebaseFirestore.DocumentReference,
    value: unknown,
  ) => {
    if (!writer) return
    pending.push(
      writer
        .create(reference, clean(value) as FirebaseFirestore.DocumentData)
        .then(
          () => ({}),
          (error) => (errorCode(error) === 6 ? {} : { error }),
        ),
    )
    if (pending.length >= 400) {
      await flush()
    }
  }
  try {
    let pageToken: string | undefined
    do {
      const [files, next]: GetFilesResponse = await bucket.getFiles({
        prefix: 'organization-permissions/',
        autoPaginate: false,
        maxResults: 100,
        pageToken,
      })
      pageToken = (next as { pageToken?: string } | undefined)?.pageToken
      for (const file of files) {
        const match =
          /^organization-permissions\/([^/]+)\/(ledger|memberships)\.json$/.exec(
            file.name,
          )
        if (!match) continue
        const uid = match[1]
        if (apply && (await accountRef(uid).get()).get('deleting'))
          throw new Error(
            'A source account has already been erased; import stopped',
          )
        const [bytes] = await file.download()
        if (match[2] === 'memberships') {
          const records = JSON.parse(bytes.toString()) as Record<
            string,
            Membership
          >
          for (const member of Object.values(records)) {
            await put(
              db()
                .collection('organizationMemberships')
                .doc(permissionId(uid, member.organizationId, 'membership')),
              { ...member, ownerUid: uid },
            )
            counts.memberships++
          }
          // Membership-only accounts still need an authorization/deletion guard.
          await put(accountRef(uid), { permissionCount: 0, mutationCount: 0 })
        } else {
          const ledger = JSON.parse(bytes.toString()) as LegacyLedger
          const organizations = new Set([
            ...Object.keys(ledger.epochs),
            ...Object.keys(ledger.blockedOrganizations ?? {}),
            ...ledger.permissions.map(
              (permission) => permission.organizationId,
            ),
          ])
          for (const permission of ledger.permissions) {
            await put(
              permissionRef(
                uid,
                permission.organizationId,
                permission.submissionId,
              ),
              {
                ownerUid: uid,
                organizationId: permission.organizationId,
                submissionId: permission.submissionId,
                permission,
              },
            )
            counts.permissions++
          }
          for (const pair of ledger.revokedPairs ?? []) {
            const [organizationId, submissionId] = pair.split('/')
            organizations.add(organizationId)
            await put(permissionRef(uid, organizationId, submissionId), {
              ownerUid: uid,
              organizationId,
              submissionId,
              revokedAt: 'legacy-revocation',
            })
          }
          for (const organizationId of organizations)
            await put(stateRef(uid, organizationId), {
              epoch: ledger.epochs[organizationId] ?? 0,
              blockedToken:
                ledger.blockedOrganizations?.[organizationId] ?? null,
            })
          for (const id of ledger.applied ?? []) {
            await put(
              accountRef(uid)
                .collection('mutations')
                .doc(createHash('sha256').update(id).digest('hex')),
              { appliedAt: 'legacy' },
            )
            counts.receipts++
          }
          // Account counters are authoritative for admission limits. Upsert after create-only imports.
          await flush()
          if (apply)
            await accountRef(uid).set(
              {
                permissionCount: ledger.permissions.length,
                mutationCount: ledger.applied?.length ?? 0,
              },
              { merge: true },
            )
        }
      }
    } while (pageToken)
    pageToken = undefined
    do {
      const [files, next]: GetFilesResponse = await bucket.getFiles({
        prefix: 'organization-invites/',
        autoPaginate: false,
        maxResults: 100,
        pageToken,
      })
      pageToken = (next as { pageToken?: string } | undefined)?.pageToken
      for (const file of files) {
        const hash = /^organization-invites\/([a-f0-9]{64})\.json$/.exec(
          file.name,
        )?.[1]
        if (!hash) continue
        const [bytes] = await file.download()
        await put(
          db().collection('organizationInvites').doc(hash),
          JSON.parse(bytes.toString()),
        )
        counts.invites++
      }
    } while (pageToken)
    await flush()
    if (apply) {
      if (catalog) await writeCatalog(catalog)
      await progress.set({ status: 'complete', counts }, { merge: true })
    }
    return { mode: apply ? 'applied' : 'dry-run', ...counts }
  } finally {
    await writer?.close()
  }
}
