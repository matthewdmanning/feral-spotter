import { organizationCopy } from '@/src/shared/config/text'
import {
  effectiveSharingSettings,
  offeredFields,
  type GrantRequest,
  type SharingFields,
  type SharingSettings,
} from '@/src/shared/types/Organizations'

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

/** The one place a grant is assembled from the user's current choices. */
export function buildGrant(input: {
  submissionId: string
  organizationId: string
  catalogVersion: string
  epoch: number
  anonymous: boolean
  settings: SharingSettings
  email: string | null | undefined
}): GrantRequest {
  const settings = effectiveSharingSettings(input.settings, input.anonymous)
  return {
    submissionId: input.submissionId,
    organizationId: input.organizationId,
    catalogVersion: input.catalogVersion,
    epoch: input.epoch,
    anonymous: input.anonymous,
    settings,
    contactEmail: settings.fields.email ? (input.email ?? null) : null,
    disclosureVersion: 1,
  }
}
