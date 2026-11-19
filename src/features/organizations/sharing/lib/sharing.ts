import { organizationCopy } from '@/src/shared/config/text'
import {
  offeredFields,
  type SharingSettings,
} from '@/src/shared/types/Organizations'

export const FIELD_LABELS = organizationCopy.fieldLabels
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
