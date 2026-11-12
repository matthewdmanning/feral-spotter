import type { Permission, PermissionLedger } from './domain'
import { RequestError } from './errors'

export type LedgerMutation =
  | { type: 'blockOrganization'; organizationId: string; token: string }
  | { type: 'unblockOrganization'; organizationId: string; token: string }
  | {
      type: 'replaceOrganization'
      organizationId: string
      epoch: number
      permissions: Permission[]
      token: string
    }
  | { type: 'grant'; organizationId: string; permission: Permission }
  | { type: 'revoke'; organizationId: string; submissionId: string }
  | { type: 'revokeOrganization'; organizationId: string }

const pairKey = (organizationId: string, submissionId: string) =>
  `${organizationId}/${submissionId}`

/** Applies monotonic revocations. A retry can never overwrite a grant or tombstone. */
export function mutateLedger(
  ledger: PermissionLedger,
  mutation: LedgerMutation,
  now: string,
): PermissionLedger {
  const revokedPairs = [...(ledger.revokedPairs ?? [])]
  const next: PermissionLedger = {
    blockedOrganizations: { ...ledger.blockedOrganizations },
    epochs: { ...ledger.epochs },
    permissions: ledger.permissions.map((p) => ({ ...p })),
    revokedPairs,
  }
  const { organizationId } = mutation
  const find = (submissionId: string) =>
    next.permissions.find(
      (p) =>
        p.organizationId === organizationId && p.submissionId === submissionId,
    )
  switch (mutation.type) {
    case 'blockOrganization':
      if (
        next.blockedOrganizations![organizationId] &&
        next.blockedOrganizations![organizationId] !== mutation.token
      )
        throw RequestError.confirmAgain(
          'Another permission update is in progress',
        )
      next.blockedOrganizations![organizationId] = mutation.token
      break
    case 'unblockOrganization':
      if (next.blockedOrganizations![organizationId] !== mutation.token)
        throw RequestError.confirmAgain('Permission update changed')
      delete next.blockedOrganizations![organizationId]
      break
    case 'replaceOrganization': {
      if (
        next.blockedOrganizations![organizationId] !== mutation.token ||
        mutation.epoch !== (next.epochs[organizationId] ?? 0)
      )
        throw RequestError.confirmAgain('Permissions changed; review again')
      const active = next.permissions.filter(
        (p) => p.organizationId === organizationId && !p.revokedAt,
      )
      if (
        mutation.permissions.length !== active.length ||
        new Set(mutation.permissions.map((p) => p.submissionId)).size !==
          active.length ||
        mutation.permissions.some(
          (p) =>
            p.organizationId !== organizationId ||
            !active.some((old) => old.submissionId === p.submissionId),
        )
      )
        throw RequestError.confirmAgain(
          'Shared Sightings changed; review again',
        )
      next.epochs[organizationId] = mutation.epoch + 1
      next.permissions = next.permissions.map((p) => {
        if (p.organizationId !== organizationId || p.revokedAt) return p
        return {
          ...mutation.permissions.find(
            (replacement) => replacement.submissionId === p.submissionId,
          )!,
          epoch: mutation.epoch + 1,
        }
      })
      break
    }
    case 'revokeOrganization':
      next.epochs[organizationId] = (next.epochs[organizationId] ?? 0) + 1
      for (const p of next.permissions)
        if (p.organizationId === organizationId) p.revokedAt ??= now
      break
    case 'revoke': {
      const permission = find(mutation.submissionId)
      const key = pairKey(organizationId, mutation.submissionId)
      if (permission) permission.revokedAt ??= now
      else if (!revokedPairs.includes(key)) revokedPairs.push(key)
      break
    }
    case 'grant': {
      const { permission } = mutation
      const existing = find(permission.submissionId)
      if (
        next.blockedOrganizations?.[organizationId] ||
        revokedPairs.includes(
          pairKey(organizationId, permission.submissionId),
        ) ||
        existing?.revokedAt ||
        permission.epoch !== (next.epochs[organizationId] ?? 0)
      )
        throw RequestError.confirmAgain('Permission revoked; confirm again')
      if (!existing) next.permissions.push(permission)
    }
  }
  return next
}
