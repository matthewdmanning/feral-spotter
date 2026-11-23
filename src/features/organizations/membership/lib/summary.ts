import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import { COVERAGE_CENTER_FRACTION_DIGITS } from '@/src/shared/config/constants'
import type {
  MembershipLocation,
  MembershipSummary,
} from '@/functions/src/organizations/membership/domain'

const copy = organizationCopy.membership

export function memberCountLabel(count: number): string {
  return count === 1
    ? copy.memberCount.one
    : formatCopy(copy.memberCount.other, { count })
}

/** The catalog label, else the coverage center in the device locale. */
export function membershipLocationLabel(location: MembershipLocation): string {
  if (location.label) return location.label
  const format = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: COVERAGE_CENTER_FRACTION_DIGITS,
  })
  return formatCopy(copy.locationNear, {
    latitude: format.format(location.center.latitude),
    longitude: format.format(location.center.longitude),
  })
}

/**
 * Applies the account's saved card order. Memberships missing from the saved
 * order (new joins) keep the server's order after the saved ones.
 */
export function orderMemberships(
  memberships: readonly MembershipSummary[],
  order: readonly string[] | undefined,
): MembershipSummary[] {
  if (!order?.length) return [...memberships]
  const rank = new Map(order.map((id, index) => [id, index]))
  const unranked = order.length
  return memberships
    .map((member, index) => ({ member, index }))
    .sort(
      (a, b) =>
        (rank.get(a.member.organizationId) ?? unranked) -
          (rank.get(b.member.organizationId) ?? unranked) || a.index - b.index,
    )
    .map(({ member }) => member)
}
