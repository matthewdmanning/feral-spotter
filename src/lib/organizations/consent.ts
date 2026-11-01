import { useAuthStore } from '@/src/features/auth/lib/authStore'
import type {
  OrganizationSharingDraft,
  SubmissionDraft,
} from '@/src/hooks/useSubmissionStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
  type AccountSharing,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'

/**
 * Binds confirmation to exactly the location, organizations and disclosure the
 * user saw, plus the revocation epoch of each selected organization only.
 */
export function sharingSignature(
  draft: OrganizationSharingDraft,
  account: Pick<AccountSharing, 'settings' | 'ledger'>,
  submission: Pick<
    SubmissionDraft,
    'latitude' | 'longitude' | 'report_injured'
  >,
  email: string | null | undefined,
): string {
  const selectedIds = draft.selectedIds.slice().sort()
  return JSON.stringify({
    owner: draft.ownerUid,
    selectedIds,
    anonymous: draft.anonymous,
    catalogVersion: draft.catalogVersion,
    settings: account.settings,
    latitude: submission.latitude,
    longitude: submission.longitude,
    injured: submission.report_injured === true,
    email: email ?? null,
    epochs: selectedIds.map((id) => account.ledger.epochs[id] ?? 0),
  })
}
/** Throws before sending when a selected sharing configuration has changed since confirmation. */
export function confirmedSharing(uid: string) {
  if (!useOrganizationsFlag.getState().enabled) return null
  const { organizationSharing: draft, submission } =
    useSubmissionStore.getState()
  if (!draft || draft.ownerUid !== uid || !draft.selectedIds.length) return null
  const account =
    useOrganizationSharingStore.getState().accounts[uid] ??
    EMPTY_ORGANIZATION_ACCOUNT
  const signature = sharingSignature(
    draft,
    account,
    submission,
    useAuthStore.getState().user?.email,
  )
  if (draft.confirmedSignature !== signature)
    throw new Error(
      'Review the organization choices and confirm “Share this sighting”, or choose not to share.',
    )
  return {
    draft,
    settings: account.settings,
    epochs: { ...account.ledger.epochs },
  }
}
