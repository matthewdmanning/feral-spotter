import type { Location, SharingSettings, PermissionLedger } from '../domain'

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
  /** Server-assigned when an attempt starts; never taken from the client. */
  attempt?: string
}
export interface Membership {
  organizationId: string
  requestId: string
  displayName: string
  status: MembershipStatus
  /** Durable checkpoint: retries finish the same permission change. Never returned in roster reads. */
  exit?: LeaveChoice
}
/** Where an organization works: its catalog label, else its coverage center. */
export interface MembershipLocation {
  label: string | null
  center: Location
}
export interface MembershipSummary {
  organizationId: string
  organizationName: string
  status: MembershipStatus
  leaving: boolean
  /** Active members; null when the organization is no longer in the catalog. */
  memberCount: number | null
  location: MembershipLocation | null
}
export interface MembershipList {
  ledger?: PermissionLedger
  memberships: MembershipSummary[]
}

export const MEMBER_NAME_MAX_LENGTH = 80

/** The account name members see; one value shared by every membership. */
export function memberName(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !input.trim() ||
    input.trim().length > MEMBER_NAME_MAX_LENGTH
  )
    throw new Error(
      `Enter a display name of 1–${MEMBER_NAME_MAX_LENGTH} characters`,
    )
  return input.trim()
}
