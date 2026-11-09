import { FieldPath } from 'firebase-admin/firestore'
import { accountRef, checkedAccount, clean, db, permissionId } from '../store'
import { RequestError } from '../errors'
import type { Membership } from './domain'

type Records = Record<string, Membership>
export const membershipRef = (uid: string, organizationId: string) =>
  db()
    .collection('organizationMemberships')
    .doc(permissionId(uid, organizationId, 'membership'))

/** Membership is an optional feature: core permission stores never read these documents. */
export async function readMemberships(uid: string): Promise<Records> {
  return db().runTransaction(
    async (transaction) => {
      await checkedAccount(transaction, uid)
      const records = await transaction.get(
        db().collection('organizationMemberships').where('ownerUid', '==', uid),
      )
      return Object.fromEntries(
        records.docs.map((doc) => {
          const { ownerUid: _uid, ...member } = doc.data()
          return [member.organizationId, member as Membership]
        }),
      )
    },
    { readOnly: true },
  )
}

export async function changeMembership(
  uid: string,
  organizationId: string,
  change: (records: Records) => Records,
): Promise<Records> {
  return db().runTransaction(async (transaction) => {
    await checkedAccount(transaction, uid)
    const reference = membershipRef(uid, organizationId)
    const existing = await transaction.get(reference)
    const next = change(
      existing.exists
        ? { [organizationId]: existing.data() as Membership }
        : {},
    )
    const member = next[organizationId]
    if (!member) throw new RequestError(404, 'Membership unavailable')
    const previousStatus = existing.get('status')
    if (
      (member.status === 'active' || member.status === 'pending') &&
      member.status !== previousStatus
    ) {
      const organization = await transaction.get(
        db().collection('organizations').doc(organizationId),
      )
      if (!organization.get('active'))
        throw RequestError.confirmAgain('Organization is unavailable')
    }
    transaction.set(reference, clean({ ...member, ownerUid: uid }))
    return next
  })
}

export async function isActiveMember(
  uid: string,
  organizationId: string,
): Promise<boolean> {
  return db().runTransaction(
    async (transaction) => {
      const [account, member] = await Promise.all([
        transaction.get(accountRef(uid)),
        transaction.get(membershipRef(uid, organizationId)),
      ])
      return (
        !account.get('deleting') &&
        member.get('status') === 'active' &&
        !member.get('exit')
      )
    },
    { readOnly: true },
  )
}

export async function roster(
  organizationId: string,
  cursor?: unknown,
): Promise<{ members: { displayName: string }[]; cursor: string | null }> {
  if (
    cursor !== undefined &&
    (typeof cursor !== 'string' || !/^[a-f0-9]{64}$/.test(cursor))
  )
    throw new RequestError(400, 'Invalid cursor')
  let query = db()
    .collection('organizationMemberships')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .orderBy(FieldPath.documentId())
    .limit(100)
  if (cursor) query = query.startAfter(cursor)
  return db().runTransaction(
    async (transaction) => {
      const result = await transaction.get(query)
      const members: { displayName: string }[] = []
      const accounts = result.size
        ? await transaction.getAll(
            ...result.docs.map((doc) => accountRef(doc.get('ownerUid'))),
          )
        : []
      result.docs.forEach((doc, index) => {
        if (!doc.get('exit') && !accounts[index].get('deleting'))
          members.push({ displayName: doc.get('displayName') })
      })
      return {
        members,
        cursor:
          result.size === 100 ? result.docs[result.docs.length - 1].id : null,
      }
    },
    { readOnly: true },
  )
}
