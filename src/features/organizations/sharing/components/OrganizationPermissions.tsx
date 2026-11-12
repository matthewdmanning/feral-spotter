import { useEffect, useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { View } from 'react-native'
import {
  commonCopy,
  formatCopy,
  organizationCopy,
} from '@/src/shared/config/text'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
  type PendingOrganizationAction,
  type ReviewedGrant,
  persistOrganizationSharing,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import {
  FALLBACK_ORGANIZATION_NAME,
  includedSummary,
} from '@/src/features/organizations/sharing/lib/sharing'
import { styles } from '@/src/features/organizations/components/styles'

function reviewMessage({ grant, organizationName }: ReviewedGrant): string {
  const contact = [
    grant.settings.name,
    grant.contactEmail,
    grant.settings.phone,
  ].filter(Boolean)
  const contactSummary = grant.anonymous
    ? organizationCopy.permissions.anonymousContact
    : contact.length
      ? formatCopy(organizationCopy.permissions.contactValue, {
          contact: contact.join(organizationCopy.listSeparator),
        })
      : organizationCopy.permissions.noContactSelected
  return formatCopy(organizationCopy.permissions.reviewCurrentCoverage, {
    organization: organizationName,
    fields: includedSummary(grant.settings, grant.anonymous),
    contact: contactSummary,
  })
}

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
      p.action === 'revokeOrganization' ||
      (p.action === 'revoke' && p.submissionId === submissionId) ||
      (p.action === 'grant' && p.grant.submissionId === submissionId),
  )
  if (!permissions.length && !pending.length) return null
  const copy = organizationCopy.permissions
  const revoke = (organizationId: string, sightingId?: string) =>
    showAlert(copy.revokeTitle, copy.revokeMessage, [
      { text: commonCopy.cancel, style: 'cancel' },
      {
        text: copy.revoke,
        style: 'destructive',
        onPress: () =>
          useOrganizationSharingStore
            .getState()
            .revoke(uid, organizationId, sightingId),
      },
    ])
  const review = async (item: PendingOrganizationAction) => {
    const state = useOrganizationSharingStore.getState()
    let reviewed: ReviewedGrant | null
    try {
      reviewed = await state.prepareReview(uid, item.mutationId)
    } catch {
      setMessage(copy.connectToReview)
      return
    }
    if (!reviewed) {
      setMessage(copy.organizationUnavailable)
      return
    }
    showAlert(copy.confirmAgainTitle, reviewMessage(reviewed), [
      { text: commonCopy.cancel, style: 'cancel' },
      {
        text: organizationCopy.submission.confirmSharing,
        onPress: async () => {
          if (!state.reconfirm(uid, item.mutationId, reviewed)) {
            setMessage(copy.choicesChanged)
            return
          }
          try {
            await persistOrganizationSharing()
            void state.sync(uid)
          } catch {
            setMessage(copy.permissionPending)
          }
        },
      },
    ])
  }
  const organizations = [
    ...new Map(
      permissions.map((p) => [p.organizationId, p.organizationName]),
    ).entries(),
  ]
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.hint}>{copy.deliveryNotice}</Text>
      {permissions.map((permission) => {
        const revoking = pending.some(
          (item) =>
            item.organizationId === permission.organizationId &&
            (item.action === 'revokeOrganization' ||
              (item.action === 'revoke' &&
                item.submissionId === permission.submissionId)),
        )
        return (
          <View key={`${permission.organizationId}-${permission.submissionId}`}>
            <Text style={styles.body}>
              {formatCopy(copy.permissionStatus, {
                organization: permission.organizationName,
                status: permission.revokedAt
                  ? copy.revoked
                  : revoking
                    ? copy.revocationPending
                    : copy.permissionSaved,
              })}
            </Text>
            {submissionId && !permission.revokedAt && !revoking && (
              <TextButton
                tone="danger"
                onPress={() =>
                  revoke(permission.organizationId, permission.submissionId)
                }
              >
                {copy.revokeForSighting}
              </TextButton>
            )}
          </View>
        )
      })}
      {pending.map((item) =>
        item.action === 'grant' ? (
          <View key={item.mutationId}>
            <Text style={styles.body}>
              {formatCopy(copy.pendingStatus, {
                organization:
                  item.organizationName ?? FALLBACK_ORGANIZATION_NAME,
                status: item.requiresConfirmation
                  ? copy.notSharedReview
                  : copy.permissionPendingConnection,
              })}
            </Text>
            {item.requiresConfirmation && enabled && (
              <TextButton
                onPress={() => {
                  void review(item)
                }}
              >
                {copy.reviewSharing}
              </TextButton>
            )}
            <TextButton
              tone="danger"
              onPress={() =>
                revoke(item.organizationId, item.grant.submissionId)
              }
            >
              {copy.cancelPermission}
            </TextButton>
          </View>
        ) : null,
      )}
      {!submissionId &&
        organizations.map(([id, name]) => (
          <TextButton key={id} tone="danger" onPress={() => revoke(id)}>
            {formatCopy(copy.revokeAllForOrganization, {
              organization: name,
            })}
          </TextButton>
        ))}
      {pending
        .filter((item) => item.action !== 'grant')
        .map((item) => (
          <Text key={item.mutationId} style={styles.body}>
            {copy.revocationPendingConnection}
          </Text>
        ))}
      {pending.length > 0 && (
        <TextButton
          onPress={() => {
            void useOrganizationSharingStore.getState().sync(uid)
          }}
        >
          {copy.retrySync}
        </TextButton>
      )}
      {!!message && <Text style={styles.hint}>{message}</Text>}
    </GlassSurface>
  )
}
