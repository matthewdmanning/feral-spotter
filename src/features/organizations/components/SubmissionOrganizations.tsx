import { Text } from '@/src/shared/ui/atoms/Text'
import {
  commonCopy,
  formatCopy,
  organizationCopy,
} from '@/src/shared/config/text'

import { router } from 'expo-router'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useSubmissionOrganizationsViewModel } from '@/src/features/organizations/viewmodels/useSubmissionOrganizationsViewModel'
import { includedSummary } from '@/src/features/organizations/lib/sharing'
import { SharingCheckbox } from './SharingCheckbox'
import { styles } from './styles'

export function SubmissionOrganizations() {
  const model = useSubmissionOrganizationsViewModel()
  const {
    user,
    enabled,
    hydrated,
    submission,
    setSubmission,
    account,
    directory,
    draft,
    signature,
    patch,
    setConfirmed,
  } = model
  if (!enabled || !user || !hydrated) return null
  const copy = organizationCopy.submission
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <SharingCheckbox
        label={copy.injuredCat}
        checked={submission.report_injured === true}
        onChange={(report_injured) => setSubmission({ report_injured })}
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
            onChange={(checked) => setConfirmed(checked)}
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
