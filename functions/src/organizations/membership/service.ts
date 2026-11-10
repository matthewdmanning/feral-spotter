import { createHash, randomBytes } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { db, readOrganization } from '../store'
import { changeMembership, readMemberships } from './store'
import { makePermission, validateGrant } from '../api'
import { readLedger, updateLedger } from '../store'
import { validId, type Permission } from '../domain'
import { RequestError } from '../errors'
import { memberName, type LeaveChoice, type Membership } from './domain'

const invitePath = (code: string) =>
  `organizationInvites/${createHash('sha256').update(code).digest('hex')}`

export async function createInvite(organizationId: string) {
  await readOrganization(organizationId)
  const code = randomBytes(24).toString('base64url')
  await db().doc(invitePath(code)).create({ organizationId })
  return code
}

export async function joinOrganization(
  uid: string,
  code: unknown,
  name: unknown,
) {
  if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{32}$/.test(code.trim()))
    throw new RequestError(400, 'Invalid invite code')
  let displayName: string
  try {
    displayName = memberName(name)
  } catch {
    throw new RequestError(400, 'Invalid display name')
  }
  const invite = (await db().doc(invitePath(code.trim())).get()).data()
  if (!invite || !validId(invite.organizationId))
    throw new RequestError(404, 'Invalid invite code')
  const organizationId = invite.organizationId
  await readOrganization(organizationId)
  await changeMembership(uid, organizationId, (records) => {
    const previous = records[organizationId]
    if (previous?.exit)
      throw RequestError.confirmAgain('Finish leaving before joining again')
    if (previous?.status === 'active' || previous?.status === 'pending')
      return records
    return {
      ...records,
      [organizationId]: {
        organizationId,
        displayName,
        status: 'pending',
        requestId: randomBytes(16).toString('hex'),
      },
    }
  })
}

export async function renameMember(
  uid: string,
  organizationId: string,
  name: unknown,
) {
  let displayName: string
  try {
    displayName = memberName(name)
  } catch {
    throw new RequestError(400, 'Invalid display name')
  }
  await changeMembership(uid, organizationId, (records) => {
    const member = records[organizationId]
    if (
      !member ||
      !['active', 'pending'].includes(member.status) ||
      member.exit
    )
      throw new RequestError(403, 'Membership unavailable')
    return { ...records, [organizationId]: { ...member, displayName } }
  })
}

/** Names one leave attempt's block and its ledger receipts. */
function leaveToken(uid: string, organizationId: string, member: Membership) {
  const { mutationId, attempt } = member.exit!
  return createHash('sha256')
    .update(
      `${uid}/${organizationId}/${member.requestId}/${mutationId}/${attempt}`,
    )
    .digest('hex')
}

/** A durable saga: block grants, change permissions, end membership, release the block. */
export async function leaveOrganization(
  uid: string,
  organizationId: string,
  choice: LeaveChoice,
  status: 'left' | 'removed' = 'left',
) {
  if (
    !choice ||
    !validId(choice.mutationId) ||
    !['keep', 'revoke'].includes(choice.mode)
  )
    throw new RequestError(400, 'Invalid leaving choice')
  // Validate before reserving the operation, so malformed input cannot trap a membership.
  if (choice.mode === 'keep')
    validateGrant({
      submissionId: 'review',
      organizationId,
      epoch: choice.epoch,
      catalogVersion: choice.catalogVersion,
      settings: choice.settings,
      anonymous: choice.anonymous,
      contactEmail: choice.contactEmail,
      disclosureVersion: 1,
    })
  const records = await changeMembership(uid, organizationId, (records) => {
    const member = records[organizationId]
    if (!member) throw new RequestError(404, 'Membership unavailable')
    if (member.exit) {
      if (member.exit.mutationId !== choice.mutationId)
        throw RequestError.confirmAgain('Resume the existing leaving operation')
      return records
    }
    if (member.status === 'left' || member.status === 'removed') return records
    // A fresh attempt id: an aborted attempt's receipts never satisfy a retry.
    const exit = { ...choice, attempt: randomBytes(16).toString('hex') }
    return { ...records, [organizationId]: { ...member, exit } }
  })
  const member = records[organizationId]
  if (!member.exit) return
  const saved = member.exit
  const token = leaveToken(uid, organizationId, member)
  await updateLedger(uid, `block-${token}`, async () => ({
    type: 'blockOrganization',
    organizationId,
    token,
  }))
  try {
    if (saved.mode === 'revoke') {
      await updateLedger(uid, `leave-${token}`, async () => ({
        type: 'revokeOrganization',
        organizationId,
      }))
    } else {
      await updateLedger(uid, `leave-${token}`, async () => {
        const ledger = await readLedger(uid)
        const active = ledger.permissions.filter(
          (p) => p.organizationId === organizationId && !p.revokedAt,
        )
        const account = await getAuth().getUser(uid)
        const permissions: Permission[] = []
        for (const permission of active)
          permissions.push(
            await makePermission(uid, account.email, {
              submissionId: permission.submissionId,
              organizationId,
              catalogVersion: saved.catalogVersion!,
              epoch: saved.epoch!,
              settings: saved.settings!,
              anonymous: saved.anonymous!,
              contactEmail: saved.contactEmail,
              disclosureVersion: 1,
            }),
          )
        // Validate directory/email even when there are no existing shares.
        const { catalog } = await readOrganization(organizationId)
        if (
          catalog.version !== saved.catalogVersion ||
          (!saved.anonymous &&
            saved.settings!.fields.email &&
            (account.email ?? null) !== saved.contactEmail)
        )
          throw RequestError.confirmAgain(
            'Sharing choices changed; review again',
          )
        return {
          type: 'replaceOrganization',
          organizationId,
          epoch: saved.epoch!,
          token,
          permissions,
        }
      })
    }
  } catch (error) {
    // Validation failures can be corrected, or the user can choose revoke-all instead.
    if (
      error instanceof RequestError &&
      [400, 404, 409, 429].includes(error.status)
    ) {
      await updateLedger(uid, `abort-${token}`, async () => ({
        type: 'unblockOrganization',
        organizationId,
        token,
      }))
      await changeMembership(uid, organizationId, (records) => {
        const current = records[organizationId]
        if (current?.exit?.mutationId !== saved.mutationId) return records
        const { exit: _exit, ...rest } = current
        return { ...records, [organizationId]: rest }
      })
    }
    throw error
  }
  await changeMembership(uid, organizationId, (records) => ({
    ...records,
    [organizationId]: { ...records[organizationId], status, exit: saved },
  }))
  await updateLedger(uid, `finish-${token}`, async () => ({
    type: 'unblockOrganization',
    organizationId,
    token,
  }))
  await changeMembership(uid, organizationId, (records) => {
    const current = records[organizationId]
    if (current?.exit?.mutationId !== saved.mutationId) return records
    const { exit: _exit, ...rest } = current
    return { ...records, [organizationId]: rest }
  })
}

/** Operator infrastructure only. There is no member-facing administration API. */
export async function moderateMembership(
  uid: string,
  organizationId: string,
  action: 'approve' | 'reject' | 'remove',
) {
  if (!validId(uid) || !validId(organizationId))
    throw new RequestError(400, 'Invalid identifier')
  if (action === 'remove') {
    const member = (await readMemberships(uid))[organizationId]
    if (!member) throw new RequestError(404, 'Membership unavailable')
    if (member.exit) {
      try {
        await leaveOrganization(uid, organizationId, member.exit, 'removed')
      } catch (error) {
        if (!(error instanceof RequestError)) throw error
      }
    }
    await updateLedger(
      uid,
      `remove-${randomBytes(16).toString('hex')}`,
      async () => ({ type: 'revokeOrganization', organizationId }),
    )
    // A leave that could not finish still holds its block; removal ends it.
    const stuck = (await readMemberships(uid))[organizationId]
    if (stuck?.exit?.attempt) {
      const token = leaveToken(uid, organizationId, stuck)
      try {
        await updateLedger(uid, `release-${token}`, async () => ({
          type: 'unblockOrganization',
          organizationId,
          token,
        }))
      } catch (error) {
        // 409: the attempt never placed its block, or already released it.
        if (!(error instanceof RequestError && error.status === 409))
          throw error
      }
    }
    await changeMembership(uid, organizationId, (records) => {
      const { exit: _exit, ...current } = records[organizationId]
      return { ...records, [organizationId]: { ...current, status: 'removed' } }
    })
    return
  }
  await readOrganization(organizationId)
  await changeMembership(uid, organizationId, (records) => {
    const member = records[organizationId]
    if (!member || member.status !== 'pending' || member.exit)
      throw RequestError.confirmAgain('No pending request')
    return {
      ...records,
      [organizationId]: {
        ...member,
        status: action === 'approve' ? 'active' : 'rejected',
      },
    }
  })
}
