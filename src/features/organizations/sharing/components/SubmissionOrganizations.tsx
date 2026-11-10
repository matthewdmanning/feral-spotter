import { useEffect } from 'react'
import { Text } from 'react-native'
import { router } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  useSubmissionStore,
  type OrganizationSharingDraft,
} from '@/src/shared/hooks/useSubmissionStore'
import { reconcileSharingDraft } from '@/src/features/organizations/lib/draft'
import { useOrganizationDirectory } from '@/src/features/organizations/hooks/useOrganizationDirectory'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { sharingSignature } from '@/src/features/organizations/sharing/lib/consent'
import { includedSummary } from '@/src/features/organizations/sharing/lib/sharing'
import { SharingCheckbox } from './SharingCheckbox'
import { styles } from '@/src/features/organizations/components/styles'

export function SubmissionOrganizations() {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const hydrated = useOrganizationSharingStore((s) => s.hydrated)
  const submission = useSubmissionStore((s) => s.submission)
  const storedDraft = useSubmissionStore((s) => s.organizationSharing)
  const setDraft = useSubmissionStore((s) => s.setOrganizationSharing)
  const setReportInjured = useSubmissionStore((s) => s.setReportInjured)
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
  useEffect(() => {
    if (
      !user ||
      !enabled ||
      !hydrated ||
      !directory.cache ||
      submission.latitude == null ||
      submission.longitude == null
    )
      return
    const next = reconcileSharingDraft(draft, {
      ownerUid: user.uid,
      preferredIds: account.preferredIds,
      catalogVersion: directory.cache.version,
      organizations: directory.organizations,
    })
    if (next !== draft) setDraft(next)
  }, [
    user,
    enabled,
    hydrated,
    directory.cache,
    submission.latitude,
    submission.longitude,
    account.preferredIds,
    draft,
    setDraft,
    directory.organizations,
  ])
  if (!enabled || !user || !hydrated) return null
  const signature = draft
    ? sharingSignature(draft, account, submission, user.email)
    : null
  const patch = (value: Partial<OrganizationSharingDraft>) => {
    if (draft) setDraft({ ...draft, ...value, confirmedSignature: null })
  }
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>Share with organizations</Text>
      <SharingCheckbox
        label="Report an injured cat"
        checked={submission.report_injured === true}
        onChange={setReportInjured}
      />
      <Text style={styles.hint}>
        This does not contact or notify an organization. No rescue response is
        requested.
      </Text>
      {submission.latitude == null || submission.longitude == null ? (
        <Text style={styles.body}>
          Set this sighting’s location to find organizations that cover the
          area.
        </Text>
      ) : (
        <>
          {directory.loading && (
            <Text style={styles.hint}>Updating organizations…</Text>
          )}
          {(!directory.online || directory.refreshFailed) && (
            <Text style={styles.hint}>
              {directory.cache
                ? `Using saved coverage from ${new Date(directory.cache.fetchedAt).toLocaleDateString()}. Choices will be checked when online.`
                : directory.online
                  ? 'Organization coverage is unavailable. Try again later; you can still submit without sharing.'
                  : 'Connect to load organization coverage. You can still submit without sharing.'}
            </Text>
          )}
          {directory.refreshFailed && (
            <TextButton
              onPress={() => {
                void directory.refresh()
              }}
            >
              Retry organization coverage
            </TextButton>
          )}
          {!directory.loading &&
            directory.cache &&
            !directory.organizations.length && (
              <Text style={styles.body}>
                {directory.online && !directory.refreshFailed
                  ? 'No organizations cover this sighting’s location.'
                  : 'No saved organizations cover this sighting’s location. Connect to check current coverage.'}
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
            label="Anonymous"
            checked={draft.anonymous}
            onChange={(anonymous) => patch({ anonymous })}
          />
          <Text style={styles.body}>
            Included: {includedSummary(account.settings, draft.anonymous)}.
          </Text>
          {!draft.anonymous && account.settings.fields.email && (
            <Text style={styles.hint}>
              Email: {user.email ?? 'not available'}
            </Text>
          )}
          {!draft.anonymous && account.settings.fields.name && (
            <Text style={styles.hint}>
              Name: {account.settings.name || 'not configured'}
            </Text>
          )}
          {!draft.anonymous && account.settings.fields.phone && (
            <Text style={styles.hint}>
              Phone: {account.settings.phone || 'not configured'}
            </Text>
          )}
          <Text style={styles.hint}>
            Revoking access stops future access. Copies already received cannot
            be recalled.
          </Text>
          <SharingCheckbox
            label="Share this sighting"
            checked={draft.confirmedSignature === signature}
            onChange={(checked) =>
              setDraft({
                ...draft,
                confirmedSignature: checked ? signature : null,
              })
            }
          />
          <TextButton onPress={() => patch({ selectedIds: [] })}>
            Don’t share this sighting
          </TextButton>
        </>
      )}
      <TextButton onPress={() => router.push('/(home-tabs)/settings')}>
        Configure shared fields in Settings
      </TextButton>
    </GlassSurface>
  )
}
