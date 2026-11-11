import { useEffect, useMemo } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import {
  commonCopy,
  formatCopy,
  organizationCopy,
} from '@/src/shared/config/text'

import { router } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  useSubmissionStore,
  type OrganizationSharingDraft,
} from '@/src/shared/hooks/useSubmissionStore'
import { useOrganizationDirectory } from '@/src/features/organizations/hooks/useOrganizationDirectory'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { sharingSignature } from '@/src/features/organizations/lib/consent'
import { includedSummary } from '@/src/features/organizations/lib/sharing'
import { SharingCheckbox } from './SharingCheckbox'
import { styles } from './styles'

export function SubmissionOrganizations() {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const hydrated = useOrganizationSharingStore((s) => s.hydrated)
  const submission = useSubmissionStore((s) => s.submission)
  const storedDraft = useSubmissionStore((s) => s.organizationSharing)
  const setDraft = useSubmissionStore((s) => s.setOrganizationSharing)
  const account = useOrganizationSharingStore((s) =>
    user
      ? (s.accounts[user.uid] ?? EMPTY_ORGANIZATION_ACCOUNT)
      : EMPTY_ORGANIZATION_ACCOUNT,
  )
  const directory = useOrganizationDirectory(
    submission.latitude,
    submission.longitude,
  )
  const draft = storedDraft?.ownerUid === user?.uid ? storedDraft : null
  const eligibleIds = useMemo(
    () => directory.organizations.map((org) => org.id),
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
      directory.organizations.map((org) => [org.id, org.name]),
    )
    if (!draft || JSON.stringify(next) !== JSON.stringify(draft))
      setDraft({ ...next, confirmedSignature: null })
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
  if (!enabled || !user || !hydrated) return null
  const copy = organizationCopy.submission
  const signature = draft
    ? sharingSignature(draft, account, submission, user.email)
    : null
  const patch = (value: Partial<OrganizationSharingDraft>) => {
    if (draft) setDraft({ ...draft, ...value, confirmedSignature: null })
  }
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <SharingCheckbox
        label={copy.injuredCat}
        checked={submission.report_injured === true}
        onChange={(report_injured) =>
          useSubmissionStore.getState().setSubmission({ report_injured })
        }
      />
      <Text style={styles.hint}>{copy.noContactNotice}</Text>
      {submission.latitude == null || submission.longitude == null ? (
        <Text style={styles.body}>{copy.locationNeeded}</Text>
      ) : (
        <>
          {directory.loading && (
            <Text style={styles.hint}>{copy.updatingCoverage}</Text>
          )}
          {(!directory.online || directory.refreshFailed) && (
            <Text style={styles.hint}>
              {directory.cache
                ? formatCopy(copy.savedCoverage, {
                    date: new Date(
                      directory.cache.fetchedAt,
                    ).toLocaleDateString(),
                  })
                : directory.online
                  ? copy.coverageUnavailable
                  : copy.connectForCoverage}
            </Text>
          )}
          {directory.refreshFailed && (
            <TextButton
              onPress={() => {
                void directory.refresh()
              }}
            >
              {copy.retryCoverage}
            </TextButton>
          )}
          {!directory.loading &&
            directory.cache &&
            !directory.organizations.length && (
              <Text style={styles.body}>
                {directory.online && !directory.refreshFailed
                  ? copy.noCoverage
                  : copy.noSavedCoverage}
              </Text>
            )}
          {directory.organizations.map((org) => (
            <SharingCheckbox
              key={org.id}
              label={org.name}
              checked={draft?.selectedIds.includes(org.id) ?? false}
              onChange={(checked) =>
                patch({
                  selectedIds: checked
                    ? [...(draft?.selectedIds ?? []), org.id]
                    : (draft?.selectedIds.filter((id) => id !== org.id) ?? []),
                })
              }
            />
          ))}
        </>
      )}
      {!!draft?.selectedIds.length && (
        <>
          <SharingCheckbox
            label={copy.anonymous}
            checked={draft.anonymous}
            onChange={(anonymous) => patch({ anonymous })}
          />
          <Text style={styles.body}>
            {formatCopy(copy.included, {
              fields: includedSummary(account.settings, draft.anonymous),
            })}
          </Text>
          {!draft.anonymous && account.settings.fields.email && (
            <Text style={styles.hint}>
              {formatCopy(copy.emailValue, {
                email: user.email ?? commonCopy.notAvailable,
              })}
            </Text>
          )}
          {!draft.anonymous && account.settings.fields.name && (
            <Text style={styles.hint}>
              {formatCopy(copy.nameValue, {
                name: account.settings.name || commonCopy.notConfigured,
              })}
            </Text>
          )}
          {!draft.anonymous && account.settings.fields.phone && (
            <Text style={styles.hint}>
              {formatCopy(copy.phoneValue, {
                phone: account.settings.phone || commonCopy.notConfigured,
              })}
            </Text>
          )}
          <Text style={styles.hint}>{copy.revocationDisclosure}</Text>
          <SharingCheckbox
            label={copy.confirmSharing}
            checked={draft.confirmedSignature === signature}
            onChange={(checked) =>
              setDraft({
                ...draft,
                confirmedSignature: checked ? signature : null,
              })
            }
          />
          <TextButton onPress={() => patch({ selectedIds: [] })}>
            {copy.declineSharing}
          </TextButton>
        </>
      )}
      <TextButton onPress={() => router.push('/(home-tabs)/settings')}>
        {copy.configureFields}
      </TextButton>
    </GlassSurface>
  )
}
