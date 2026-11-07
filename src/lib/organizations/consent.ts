import { useAuthStore } from '@/src/lib/auth/authStore'
import type { OrganizationSharingDraft } from '@/src/hooks/useSubmissionStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import type { SharingSettings } from '@/src/types/Organizations'

/** Binds confirmation to exactly the location, organizations and disclosure the user saw. */
export function sharingSignature(
  draft: OrganizationSharingDraft,
  settings: SharingSettings,
  latitude?: number,
  longitude?: number,
  injured = false,
  email: string | null = null,
  revision: unknown = null,
): string {
  return JSON.stringify([
    draft.ownerUid,
    draft.selectedIds.slice().sort(),
    draft.anonymous,
    draft.catalogVersion,
    settings,
    latitude,
    longitude,
    injured,
    email,
    revision,
  ])
}
/** Throws before sending when a selected sharing configuration has changed since confirmation. */
export function confirmedSharing(uid: string) {
  if (!useOrganizationsFlag.getState().enabled) return null
  const state = useSubmissionStore.getState()
  const draft = state.organizationSharing
  if (!draft || draft.ownerUid !== uid || !draft.selectedIds.length) return null
  const account =
    useOrganizationSharingStore.getState().accounts[uid] ??
    EMPTY_ORGANIZATION_ACCOUNT
  const signature = sharingSignature(
    draft,
    account.settings,
    state.submission.latitude,
    state.submission.longitude,
    state.submission.report_injured,
    useAuthStore.getState().user?.email ?? null,
    [
      account.ledger.epochs,
      account.outbox
        .filter((item) => item.action !== 'grant')
        .map((item) => item.mutationId),
    ],
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
