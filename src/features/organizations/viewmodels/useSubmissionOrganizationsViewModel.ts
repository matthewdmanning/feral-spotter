import { useEffect, useMemo } from 'react'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  useSubmissionStore,
  type OrganizationSharingDraft,
} from '@/src/shared/hooks/useSubmissionStore'
import { useOrganizationDirectory } from '@/src/features/organizations/hooks/useOrganizationDirectory'
import {
  EMPTY_ORGANIZATION_ACCOUNT,
  useOrganizationSharingStore,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { sharingSignature } from '@/src/features/organizations/lib/consent'

/** Coordinates catalog eligibility, draft consent, and account preferences. */
export function useSubmissionOrganizationsViewModel() {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((state) => state.enabled)
  const hydrated = useOrganizationSharingStore((state) => state.hydrated)
  const submission = useSubmissionStore((state) => state.submission)
  const storedDraft = useSubmissionStore((state) => state.organizationSharing)
  const setDraft = useSubmissionStore((state) => state.setOrganizationSharing)
  const account = useOrganizationSharingStore((state) =>
    user
      ? (state.accounts[user.uid] ?? EMPTY_ORGANIZATION_ACCOUNT)
      : EMPTY_ORGANIZATION_ACCOUNT,
  )
  const directory = useOrganizationDirectory(
    submission.latitude,
    submission.longitude,
  )
  const draft = storedDraft?.ownerUid === user?.uid ? storedDraft : null
  const eligibleIds = useMemo(
    () => directory.organizations.map((organization) => organization.id),
    [directory.organizations],
  )

  useEffect(() => {
    if (!user || !enabled || !hydrated || !directory.cache) return
    const selectedIds = (draft?.selectedIds ?? account.preferredIds).filter(
      (id) => eligibleIds.includes(id),
    )
    const next: OrganizationSharingDraft = draft
      ? { ...draft, selectedIds, catalogVersion: directory.cache.version }
      : {
          ownerUid: user.uid,
          selectedIds,
          anonymous: true,
          catalogVersion: directory.cache.version,
          confirmedSignature: null,
        }
    next.organizationNames = Object.fromEntries(
      directory.organizations.map((organization) => [
        organization.id,
        organization.name,
      ]),
    )
    if (!draft || JSON.stringify(next) !== JSON.stringify(draft)) {
      setDraft({ ...next, confirmedSignature: null })
    }
  }, [
    user,
    enabled,
    hydrated,
    directory.cache,
    account.preferredIds,
    draft,
    setDraft,
    eligibleIds,
    directory.organizations,
  ])

  const patch = (value: Partial<OrganizationSharingDraft>) => {
    if (draft) setDraft({ ...draft, ...value, confirmedSignature: null })
  }

  return {
    user,
    enabled,
    hydrated,
    submission,
    setSubmission: (value: Partial<typeof submission>) =>
      useSubmissionStore.getState().setSubmission(value),
    account,
    directory,
    draft,
    signature: draft
      ? sharingSignature(draft, account, submission, user?.email)
      : null,
    patch,
    setConfirmed: (confirmed: boolean) => {
      if (draft) {
        setDraft({
          ...draft,
          confirmedSignature: confirmed
            ? sharingSignature(draft, account, submission, user?.email)
            : null,
        })
      }
    },
  }
}
