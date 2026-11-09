import { createHash, randomBytes } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { changeDocument, readDocument } from '../documents'
import {
  makePermission,
  readCatalog,
  readLedger,
  updateLedger,
  validateGrant,
} from '../api'
import { validId, type Permission } from '../domain'
import { RequestError } from '../errors'
import { memberName, type LeaveChoice, type Membership } from './domain'

type Records = Record<string, Membership>
const path = (uid: string) => `organization-permissions/${uid}/memberships.json`
const empty = (): Records => ({})
export const readMemberships = async (uid: string) =>
  (await readDocument(path(uid), empty)).value
const invitePath = (code: string) =>
  `organization-invites/${createHash('sha256').update(code).digest('hex')}.json`

export async function activeOrganization(organizationId: string) {
  const catalog = await readCatalog()
  const organization = catalog.organizations.find(
    (o) => o.id === organizationId && o.active,
  )
  if (!organization) throw new RequestError(404, 'Organization unavailable')
  return { catalog, organization }
}

export async function isActiveMember(
  uid: string,
  organizationId: string,
): Promise<boolean> {
  const member = (await readMemberships(uid))[organizationId]
  return member?.status === 'active' && !member.exit
}

export async function createInvite(organizationId: string) {
  await activeOrganization(organizationId)
  const code = randomBytes(24).toString('base64url')
  await getStorage()
    .bucket()
    .file(invitePath(code))
    .save(JSON.stringify({ organizationId }), {
      resumable: false,
      contentType: 'application/json',
      preconditionOpts: { ifGenerationMatch: 0 },
    })
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
  const invite = (
    await readDocument<{ organizationId?: string }>(
      invitePath(code.trim()),
      () => ({}),
    )
  ).value
  if (!validId(invite.organizationId))
    throw new RequestError(404, 'Invalid invite code')
  const organizationId = invite.organizationId
  await activeOrganization(organizationId)
  await changeDocument<Records>(path(uid), empty, (records) => {
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
  await changeDocument<Records>(path(uid), empty, (records) => {
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

export async function roster(
  organizationId: string,
): Promise<{ displayName: string }[]> {
  const names: { displayName: string }[] = []
  let pageToken: string | undefined
  do {
    const [files, next] = await getStorage().bucket().getFiles({
      prefix: 'organization-permissions/',
      matchGlob: '**/memberships.json',
      autoPaginate: false,
      maxResults: 100,
      pageToken,
    })
    pageToken = (next as { pageToken?: string } | undefined)?.pageToken
    for (const file of files) {
      const member = (await readMemberships(file.name.split('/')[1]))[
        organizationId
      ]
      if (member?.status === 'active' && !member.exit)
        names.push({ displayName: member.displayName })
    }
  } while (pageToken)
  return names.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/** A durable saga: block grants, change permissions, end membership, release the block. */
export async function leaveOrganization(
  uid: string,
  organizationId: string,
  choice: LeaveChoice,
  status: 'left' | 'removed' = 'left',
) {
  if (!validId(choice.mutationId) || !['keep', 'revoke'].includes(choice.mode))
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
  const records = await changeDocument<Records>(path(uid), empty, (records) => {
    const member = records[organizationId]
    if (!member) throw new RequestError(404, 'Membership unavailable')
    if (member.exit) {
      if (member.exit.mutationId !== choice.mutationId)
        throw RequestError.confirmAgain('Resume the existing leaving operation')
      return records
    }
    if (member.status === 'left' || member.status === 'removed') return records
    return { ...records, [organizationId]: { ...member, exit: choice } }
  })
  const member = records[organizationId]
  if (!member.exit) return
  const saved = member.exit
  const token = createHash('sha256')
    .update(
      `${uid}/${organizationId}/${member.requestId ?? 'legacy'}/${saved.mutationId}`,
    )
    .digest('hex')
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
        const ledger = (await readLedger(uid)).value
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
        const { catalog } = await activeOrganization(organizationId)
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
      [400, 404, 409].includes(error.status)
    ) {
      await updateLedger(uid, `abort-${token}`, async () => ({
        type: 'unblockOrganization',
        organizationId,
        token,
      }))
      await changeDocument<Records>(path(uid), empty, (records) => {
        const current = records[organizationId]
        if (current?.exit?.mutationId !== saved.mutationId) return records
        const { exit: _exit, ...rest } = current
        return { ...records, [organizationId]: rest }
      })
    }
    throw error
  }
  await changeDocument<Records>(path(uid), empty, (records) => ({
    ...records,
    [organizationId]: { ...records[organizationId], status, exit: saved },
  }))
  await updateLedger(uid, `finish-${token}`, async () => ({
    type: 'unblockOrganization',
    organizationId,
    token,
  }))
  await changeDocument<Records>(path(uid), empty, (records) => {
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
    await changeDocument<Records>(path(uid), empty, (records) => {
      const { exit: _exit, ...current } = records[organizationId]
      return { ...records, [organizationId]: { ...current, status: 'removed' } }
    })
    return
  }
  await activeOrganization(organizationId)
  await changeDocument<Records>(path(uid), empty, (records) => {
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
