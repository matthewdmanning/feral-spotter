import { organizationCopy } from '@/src/shared/config/text'
import {
  offeredFields,
  type SharingFields,
  type SharingSettings,
} from '@/src/shared/types/Organizations'
export { buildGrant } from '@/src/features/organizations/lib/permissions'

export const FIELD_LABELS: Record<keyof SharingFields, string> =
  organizationCopy.fieldLabels
export const FALLBACK_ORGANIZATION_NAME =
  organizationCopy.permissions.selectedOrganization

/** "cat count, approximate area[, …offered fields]" as shown before confirming. */
export function includedSummary(
  settings: SharingSettings,
  anonymous: boolean,
): string {
  return [
    organizationCopy.includedSummary.catCount,
    organizationCopy.includedSummary.approximateArea,
    ...offeredFields(settings, anonymous).map((key) => FIELD_LABELS[key]),
  ].join(organizationCopy.listSeparator)
}
