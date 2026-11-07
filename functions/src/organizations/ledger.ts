import type { Permission, PermissionLedger } from './domain'
import { RequestError } from './errors'

export type LedgerMutation =
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
