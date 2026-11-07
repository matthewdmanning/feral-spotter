import type { Permission, PermissionLedger } from './domain'

export interface LedgerMutation {
  type: 'grant' | 'revoke' | 'revokeOrganization'
  organizationId: string
  submissionId?: string
  permission?: Permission
}
/** Applies monotonic revocations. A retry can never overwrite a grant or tombstone. */
export function mutateLedger(
  ledger: PermissionLedger,
  mutation: LedgerMutation,
  now: string,
): PermissionLedger {
  const next: PermissionLedger = {
    epochs: { ...ledger.epochs },
    permissions: ledger.permissions.map((p) => ({ ...p })),
    revokedPairs: [...(ledger.revokedPairs ?? [])],
  }
  const { organizationId, submissionId } = mutation
  if (mutation.type === 'revokeOrganization') {
    next.epochs[organizationId] = (next.epochs[organizationId] ?? 0) + 1
    next.permissions.forEach((p) => {
      if (p.organizationId === organizationId) p.revokedAt ??= now
    })
  } else if (mutation.type === 'revoke') {
    const permission = next.permissions.find(
      (p) =>
        p.organizationId === organizationId && p.submissionId === submissionId,
    )
    if (permission) permission.revokedAt ??= now
    else if (!next.revokedPairs!.includes(`${organizationId}/${submissionId}`))
      next.revokedPairs!.push(`${organizationId}/${submissionId}`)
  } else {
    const permission = mutation.permission
    if (!permission) throw new Error('Missing permission')
    const existing = next.permissions.find(
      (p) =>
        p.organizationId === organizationId &&
        p.submissionId === permission.submissionId,
    )
    if (
      next.revokedPairs!.includes(
        `${organizationId}/${permission.submissionId}`,
      ) ||
      existing?.revokedAt ||
      permission.epoch !== (next.epochs[organizationId] ?? 0)
    )
      throw new Error('Permission revoked; confirm again')
    if (!existing) next.permissions.push(permission)
  }
  return next
}
