import type { OrganizationExtension } from '../api'
import { readCatalog, readLedger, readOrganization } from '../store'
import { validId } from '../domain'
import { RequestError } from '../errors'
import { requireOrganizationAccess } from '../permissions'
import { joinOrganization, leaveOrganization, renameMember } from './service'
import { isActiveMember, readMemberships, roster } from './store'
import type { LeaveChoice, MembershipList } from './domain'

async function list(uid: string): Promise<MembershipList> {
  const [records, catalog] = await Promise.all([
    readMemberships(uid),
    readCatalog(),
  ])
  return {
    memberships: Object.values(records).map((member) => ({
      organizationId: member.organizationId,
      organizationName:
        catalog.organizations.find((o) => o.id === member.organizationId)
          ?.name ?? 'Unavailable organization',
      displayName: member.displayName,
      status: member.status,
      leaving: !!member.exit,
    })),
  }
}

export const membershipExtension: OrganizationExtension = async (
  identity,
  body,
  res,
) => {
  const actions = [
    'memberships',
    'joinOrganization',
    'renameMember',
    'organizationMembers',
    'leaveOrganization',
    'resumeLeaving',
    'reviewLeaving',
  ]
  if (!actions.includes(String(body.action))) return false
  const uid = identity.uid
  if (body.action === 'memberships') {
    res.json({
      ...(await list(uid)),
      ...(body.includePermissions === true
        ? { ledger: await readLedger(uid) }
        : {}),
    })
    return true
  }
  if (body.action === 'joinOrganization') {
    await joinOrganization(uid, body.code, body.displayName)
    res.json(await list(uid))
    return true
  }
  if (!validId(body.organizationId))
    throw new RequestError(400, 'Invalid organization')
  const organizationId = body.organizationId
  if (body.action === 'organizationMembers') {
    await readOrganization(organizationId)
    requireOrganizationAccess(await isActiveMember(uid, organizationId))
    const page = await roster(organizationId, body.cursor)
    requireOrganizationAccess(await isActiveMember(uid, organizationId))
    res.json(page)
    return true
  }
  if (body.action === 'renameMember')
    await renameMember(uid, organizationId, body.displayName)
  if (body.action === 'reviewLeaving') {
    const member = (await readMemberships(uid))[organizationId]
    requireOrganizationAccess(
      !!member && ['active', 'pending'].includes(member.status) && !member.exit,
    )
    const { catalog } = await readOrganization(organizationId)
    const ledger = await readLedger(uid)
    res.json({
      catalogVersion: catalog.version,
      epoch: ledger.epochs[organizationId] ?? 0,
      shareCount: ledger.permissions.filter(
        (p) => p.organizationId === organizationId && !p.revokedAt,
      ).length,
    })
    return true
  }
  if (body.action === 'leaveOrganization')
    await leaveOrganization(
      uid,
      organizationId,
      (body.choice as LeaveChoice) ?? ({} as LeaveChoice),
    )
  if (body.action === 'resumeLeaving') {
    const member = (await readMemberships(uid))[organizationId]
    if (member?.exit)
      await leaveOrganization(
        uid,
        organizationId,
        member.exit,
        member.status === 'removed' ? 'removed' : 'left',
      )
  }
  res.json({
    ...(await list(uid)),
    ...(['leaveOrganization', 'resumeLeaving'].includes(String(body.action))
      ? { ledger: await readLedger(uid) }
      : {}),
  })
  return true
}
