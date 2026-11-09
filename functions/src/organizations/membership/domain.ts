import type { SharingSettings, PermissionLedger } from '../domain'

export type MembershipStatus =
  'pending' | 'active' | 'rejected' | 'removed' | 'left'
export interface LeaveChoice {
  mode: 'revoke' | 'keep'
  mutationId: string
  epoch?: number
  catalogVersion?: string
  settings?: SharingSettings
  anonymous?: boolean
  contactEmail?: string | null
}
export interface Membership {
  organizationId: string
  requestId: string
  displayName: string
  status: MembershipStatus
  /** Durable checkpoint: retries finish the same permission change. Never returned in roster reads. */
  exit?: LeaveChoice
}
export interface MembershipSummary {
  organizationId: string
  organizationName: string
  displayName: string
  status: MembershipStatus
  leaving: boolean
}
export interface MembershipList {
  ledger?: PermissionLedger
  memberships: MembershipSummary[]
}

export function memberName(input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || input.trim().length > 80)
    throw new Error('Enter a display name of 1–80 characters')
  return input.trim()
}
