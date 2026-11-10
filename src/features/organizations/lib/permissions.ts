import {
  effectiveSharingSettings,
  type GrantRequest,
  type SharingSettings,
} from '@/src/shared/types/Organizations'

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
