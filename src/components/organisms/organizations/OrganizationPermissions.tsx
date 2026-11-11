import {
  organizationsCopy as copy,
  formatOrganizationCopy,
  FIELD_LABELS,
} from '@/src/lib/organizations/copy'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { GlassSurface } from '@/src/components/atoms/GlassSurface'
import { TextButton } from '@/src/components/atoms/TextButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import { showAlert } from '@/src/hooks/useUIStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
  type PendingOrganizationAction,
  persistOrganizationSharing,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { organizationRequest } from '@/src/lib/organizations/api'
import {
  effectiveSharingSettings,
  type Catalog,
  type PermissionLedger,
} from '@/src/types/Organizations'
import { styles } from './styles'

/** Existing permissions stay manageable even after a flag is turned off. */
export function OrganizationPermissions({
  submissionId,
}: {
  submissionId?: string
}) {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const hydrated = useOrganizationSharingStore((s) => s.hydrated)
  const account = useOrganizationSharingStore((s) =>
    user
      ? (s.accounts[user.uid] ?? EMPTY_ORGANIZATION_ACCOUNT)
      : EMPTY_ORGANIZATION_ACCOUNT,
  )
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (user && hydrated)
      void useOrganizationSharingStore.getState().sync(user.uid)
  }, [user, hydrated])
  if (!user || !hydrated) return null
  const uid = user.uid
  const permissions = account.ledger.permissions.filter(
    (p) => !submissionId || p.submissionId === submissionId,
  )
  const pending = account.outbox.filter(
    (p) =>
      !submissionId ||
      p.submissionId === submissionId ||
      p.grant?.submissionId === submissionId ||
      p.action === 'revokeOrganization',
  )
  if (!permissions.length && !pending.length) return null
  const revoke = (organizationId: string, sightingId?: string) =>
    showAlert(copy.permissions.revokeTitle, copy.permissions.revokeBody, [
      { text: copy.common.cancel, style: 'cancel' },
      {
        text: copy.permissions.revoke,
        style: 'destructive',
        onPress: () =>
          useOrganizationSharingStore
            .getState()
            .revoke(uid, organizationId, sightingId),
      },
    ])
  const review = async (item: PendingOrganizationAction) => {
    if (!item.grant || !enabled) return
    try {
      const [catalog, ledger] = await Promise.all([
        organizationRequest<Catalog>({ action: 'catalog' }),
        organizationRequest<PermissionLedger>({ action: 'list' }),
      ])
      const organization = catalog.organizations.find(
        (org) => org.id === item.organizationId && org.active,
      )
      if (!organization) {
        setMessage(copy.permissions.orgUnavailable)
        return
      }
      const grant = {
        ...item.grant,
        settings: effectiveSharingSettings(
          account.settings,
          item.grant.anonymous,
        ),
        contactEmail:
          !item.grant.anonymous && account.settings.fields.email
            ? user.email
            : null,
        catalogVersion: catalog.version,
        epoch: ledger.epochs[item.organizationId] ?? 0,
      }
      const fields = Object.entries(FIELD_LABELS)
        .filter(
          ([key]) =>
            grant.settings.fields[key as keyof typeof FIELD_LABELS] &&
            (!grant.anonymous || !['name', 'email', 'phone'].includes(key)),
        )
        .map(([, label]) => label)
      const contactValues = [
        grant.settings.name,
        grant.contactEmail,
        grant.settings.phone,
      ].filter(Boolean)
      const contactSummary = grant.anonymous
        ? copy.permissions.anonymous
        : contactValues.length
          ? formatOrganizationCopy(copy.permissions.contact, {
              values: contactValues.join(copy.common.listSeparator),
            })
          : copy.permissions.noContact
      showAlert(
        copy.permissions.confirmTitle,
        formatOrganizationCopy(copy.permissions.confirmBody, {
          organization: organization.name,
          fields: [copy.submission.baseFields, ...fields].join(
            copy.common.listSeparator,
          ),
          contact: contactSummary,
        }),
        [
          { text: copy.common.cancel, style: 'cancel' },
          {
            text: copy.common.share,
            onPress: async () => {
              const state = useOrganizationSharingStore.getState()
              if (
                !state.reconfirm(uid, item.mutationId, grant, organization.name)
              ) {
                setMessage(copy.permissions.changed)
                return
              }
              try {
                await persistOrganizationSharing()
                void state.sync(uid)
              } catch {
                setMessage(copy.permissions.pendingError)
              }
            },
          },
        ],
      )
    } catch {
      setMessage(copy.permissions.connect)
    }
  }
  const organizations = [
    ...new Map(
      permissions.map((p) => [p.organizationId, p.organizationName]),
    ).entries(),
  ]
  return (
    <GlassSurface
      kind="card"
      style={styles.card}
      testID="organization-permissions"
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.permissions.title}
        </Text>
        <Text style={styles.hint}>{copy.permissions.delivery}</Text>
      </View>
      {(permissions.length > 0 ||
        pending.some((item) => item.action === 'grant')) && (
        <View style={styles.group}>
          {permissions.map((permission) => {
            const revoking = pending.some(
              (item) =>
                item.organizationId === permission.organizationId &&
                (item.action === 'revokeOrganization' ||
                  (item.action === 'revoke' &&
                    item.submissionId === permission.submissionId)),
            )
            return (
              <View
                key={`${permission.organizationId}-${permission.submissionId}`}
                style={styles.section}
              >
                <View style={styles.summary}>
                  <Text style={styles.itemTitle}>
                    {permission.organizationName}
                  </Text>
                  <Text style={styles.hint}>
                    {permission.revokedAt
                      ? copy.permissions.revoked
                      : revoking
                        ? copy.permissions.revoking
                        : copy.permissions.saved}
                  </Text>
                </View>
                {submissionId && !permission.revokedAt && !revoking && (
                  <TextButton
                    tone="danger"
                    onPress={() =>
                      revoke(permission.organizationId, permission.submissionId)
                    }
                  >
                    {copy.permissions.revokeSighting}
                  </TextButton>
                )}
              </View>
            )
          })}
          {pending
            .filter((item) => item.action === 'grant')
            .map((item) => (
              <View key={item.mutationId} style={styles.section}>
                <View style={styles.summary}>
                  <Text style={styles.itemTitle}>
                    {item.organizationName ?? copy.common.selectedOrganization}
                  </Text>
                  <Text style={styles.hint}>
                    {item.requiresConfirmation
                      ? copy.permissions.reviewRequired
                      : copy.permissions.pending}
                  </Text>
                </View>
                {item.requiresConfirmation && enabled && (
                  <TextButton
                    onPress={() => {
                      void review(item)
                    }}
                  >
                    {copy.permissions.review}
                  </TextButton>
                )}
                <TextButton
                  tone="danger"
                  onPress={() =>
                    revoke(item.organizationId, item.grant?.submissionId)
                  }
                >
                  {copy.permissions.cancelSharing}
                </TextButton>
              </View>
            ))}
        </View>
      )}
      {((!submissionId && organizations.length > 0) || pending.length > 0) && (
        <View style={styles.footer}>
          {!submissionId &&
            organizations.map(([id, name]) => (
              <TextButton key={id} tone="danger" onPress={() => revoke(id)}>
                {formatOrganizationCopy(copy.permissions.revokeAll, {
                  organization: name,
                })}
              </TextButton>
            ))}
          {pending
            .filter((item) => item.action !== 'grant')
            .map((item) => (
              <Text key={item.mutationId} style={styles.hint}>
                {copy.permissions.pendingRevoke}
              </Text>
            ))}
          {pending.length > 0 && (
            <TextButton
              onPress={() => {
                void useOrganizationSharingStore.getState().sync(uid)
              }}
            >
              {copy.permissions.retry}
            </TextButton>
          )}
        </View>
      )}
      {!!message && (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </GlassSurface>
  )
}
