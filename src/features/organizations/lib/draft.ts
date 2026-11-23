import type { OrganizationSharingDraft } from '@/src/shared/hooks/useSubmissionStore'

interface DirectoryChoices {
  ownerUid: string
  preferredIds: string[]
  catalogVersion: string
  organizations: { id: string; name: string }[]
}

/** Use this function to reconcile saved organization choices after a directory refresh.
 * Inputs: `current` — the saved sharing choice; `choices` — the signed-in account,
 * catalog version, preferred IDs, and eligible organizations. Dependencies: None.
 */
export function reconcileSharingDraft(
  current: OrganizationSharingDraft | null,
  choices: DirectoryChoices,
): OrganizationSharingDraft {
  const owned = current?.ownerUid === choices.ownerUid ? current : null
  const names = Object.fromEntries(
    choices.organizations.map((org) => [org.id, org.name]),
  )
  const selectedIds = [
    ...new Set(owned?.selectedIds ?? choices.preferredIds),
  ].filter((id) => Object.hasOwn(names, id))
  if (
    owned &&
    owned.catalogVersion === choices.catalogVersion &&
    owned.selectedIds.length === selectedIds.length &&
    owned.selectedIds.every((id, index) => id === selectedIds[index]) &&
    Object.keys(owned.organizationNames ?? {}).length ===
      Object.keys(names).length &&
    Object.entries(names).every(
      ([id, name]) => owned.organizationNames?.[id] === name,
    )
  ) {
    return owned
  }
  return {
    ownerUid: choices.ownerUid,
    selectedIds,
    anonymous: owned?.anonymous ?? true,
    catalogVersion: choices.catalogVersion,
    organizationNames: names,
    confirmedSignature: null,
  }
}
