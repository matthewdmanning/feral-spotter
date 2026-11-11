import {
  organizationsCopy as copy,
  formatOrganizationCopy,
  FIELD_LABELS,
} from '@/src/lib/organizations/copy'
import { useEffect, useMemo } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { GlassSurface } from '@/src/components/atoms/GlassSurface'
import { TextButton } from '@/src/components/atoms/TextButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  useSubmissionStore,
  type OrganizationSharingDraft,
} from '@/src/hooks/useSubmissionStore'
import { useOrganizationDirectory } from '@/src/hooks/useOrganizationDirectory'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { sharingSignature } from '@/src/lib/organizations/consent'
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
  const signature = draft
    ? sharingSignature(
        draft,
        account.settings,
        submission.latitude,
        submission.longitude,
        submission.report_injured,
        user.email,
        [
          account.ledger.epochs,
          account.outbox
            .filter((item) => item.action !== 'grant')
            .map((item) => item.mutationId),
        ],
      )
    : null
  const patch = (value: Partial<OrganizationSharingDraft>) => {
    if (draft) setDraft({ ...draft, ...value, confirmedSignature: null })
  }
  const optional = Object.entries(FIELD_LABELS)
    .filter(
      ([key]) =>
        account.settings.fields[key as keyof typeof FIELD_LABELS] &&
        (!draft?.anonymous || !['name', 'email', 'phone'].includes(key)),
    )
    .map(([, label]) => label)
  return (
    <GlassSurface
      kind="card"
      style={styles.card}
      testID="submission-organizations"
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.submission.title}
        </Text>
        <Text style={styles.hint}>{copy.submission.delivery}</Text>
      </View>
      <View style={styles.group}>
        <SharingCheckbox
          label={copy.submission.injured}
          checked={submission.report_injured === true}
          onChange={(report_injured) =>
            useSubmissionStore.getState().setSubmission({ report_injured })
          }
        />
        <Text style={styles.hint}>{copy.submission.injuryHint}</Text>
      </View>
      <View style={styles.group}>
        {submission.latitude == null || submission.longitude == null ? (
          <Text style={styles.body}>{copy.submission.location}</Text>
        ) : (
          <>
            {directory.loading && (
              <Text style={styles.hint}>{copy.submission.loading}</Text>
            )}
            {(!directory.online || directory.refreshFailed) && (
              <Text style={styles.hint}>
                {directory.cache
                  ? formatOrganizationCopy(copy.submission.cached, {
                      date: new Date(
                        directory.cache.fetchedAt,
                      ).toLocaleDateString(),
                    })
                  : directory.online
                    ? copy.submission.failed
                    : copy.submission.offline}
              </Text>
            )}
            {directory.refreshFailed && (
              <TextButton
                onPress={() => {
                  void directory.refresh()
                }}
              >
                {copy.submission.retry}
              </TextButton>
            )}
            {!directory.loading &&
              directory.cache &&
              !directory.organizations.length && (
                <Text style={styles.body}>
                  {directory.online && !directory.refreshFailed
                    ? copy.submission.empty
                    : copy.submission.emptyOffline}
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
                      : (draft?.selectedIds.filter((id) => id !== org.id) ??
                        []),
                  })
                }
              />
            ))}
          </>
        )}
      </View>
      {!!draft?.selectedIds.length && (
        <View style={styles.section}>
          <SharingCheckbox
            label={copy.submission.anonymous}
            checked={draft.anonymous}
            onChange={(anonymous) => patch({ anonymous })}
          />
          <View style={styles.summary}>
            <Text style={styles.body}>
              {formatOrganizationCopy(copy.submission.included, {
                fields: [copy.submission.baseFields, ...optional].join(
                  copy.common.listSeparator,
                ),
              })}
            </Text>
            {!draft.anonymous && account.settings.fields.email && (
              <Text style={styles.hint}>
                {formatOrganizationCopy(copy.submission.email, {
                  email: user.email ?? copy.common.unavailable,
                })}
              </Text>
            )}
            {!draft.anonymous && account.settings.fields.name && (
              <Text style={styles.hint}>
                {formatOrganizationCopy(copy.submission.name, {
                  name: account.settings.name || copy.common.notConfigured,
                })}
              </Text>
            )}
            {!draft.anonymous && account.settings.fields.phone && (
              <Text style={styles.hint}>
                {formatOrganizationCopy(copy.submission.phone, {
                  phone: account.settings.phone || copy.common.notConfigured,
                })}
              </Text>
            )}
          </View>
          <Text style={styles.hint}>{copy.submission.revokeHint}</Text>
          <SharingCheckbox
            label={copy.common.share}
            checked={draft.confirmedSignature === signature}
            onChange={(checked) =>
              setDraft({
                ...draft,
                confirmedSignature: checked ? signature : null,
              })
            }
          />
          <TextButton onPress={() => patch({ selectedIds: [] })}>
            {copy.submission.decline}
          </TextButton>
        </View>
      )}
      <View style={styles.footer}>
        <TextButton
          accessibilityRole="link"
          onPress={() => router.push('/(home-tabs)/settings')}
        >
          {copy.submission.configure}
        </TextButton>
      </View>
    </GlassSurface>
  )
}
