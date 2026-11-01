import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
  type PendingOrganizationAction,
  type ReviewedGrant,
  persistOrganizationSharing,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import {
  FALLBACK_ORGANIZATION_NAME,
  includedSummary,
} from '@/src/lib/organizations/sharing'
import { styles } from './styles'

function reviewMessage({ grant, organizationName }: ReviewedGrant): string {
  const contact = [
    grant.settings.name,
    grant.contactEmail,
    grant.settings.phone,
  ].filter(Boolean)
  const contactSummary = grant.anonymous
    ? 'Anonymous.'
    : contact.length
      ? `Contact: ${contact.join(', ')}.`
      : 'No contact information selected.'
  return `${organizationName}: ${includedSummary(grant.settings, grant.anonymous)}. ${contactSummary} Current coverage will be checked before permission is saved.`
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
  const revoke = (organizationId: string, sightingId?: string) =>
    showAlert(
      'Revoke organization access?',
      'This stops future access. Copies already received cannot be recalled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () =>
            useOrganizationSharingStore
              .getState()
              .revoke(uid, organizationId, sightingId),
        },
      ],
    )
  const review = async (item: PendingOrganizationAction) => {
    const state = useOrganizationSharingStore.getState()
    let reviewed: ReviewedGrant | null
    try {
      reviewed = await state.prepareReview(uid, item.mutationId)
    } catch {
      setMessage('Connect to review the current organization coverage.')
      return
    }
    if (!reviewed) {
      setMessage(
        'This organization is no longer available. No permission was granted.',
      )
      return
    }
    showAlert('Confirm sharing again', reviewMessage(reviewed), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Share this sighting',
        onPress: async () => {
          if (!state.reconfirm(uid, item.mutationId, reviewed)) {
            setMessage('Sharing choices changed. Review this permission again.')
            return
          }
          try {
            await persistOrganizationSharing()
            void state.sync(uid)
          } catch {
            setMessage('Permission remains pending. Try syncing again.')
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
      <Text style={styles.title}>Organization permissions</Text>
      <Text style={styles.hint}>
        Permissions are saved here. Organization delivery is not available yet.
      </Text>
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
              {permission.organizationName} ·{' '}
              {permission.revokedAt
                ? 'Revoked'
                : revoking
                  ? 'Revocation pending'
                  : 'Permission saved'}
            </Text>
            {submissionId && !permission.revokedAt && !revoking && (
              <TextButton
                tone="danger"
                onPress={() =>
                  revoke(permission.organizationId, permission.submissionId)
                }
              >
                Revoke access to this sighting
              </TextButton>
            )}
          </View>
        )
      })}
      {pending.map((item) =>
        item.action === 'grant' ? (
          <View key={item.mutationId}>
            <Text style={styles.body}>
              {item.organizationName ?? FALLBACK_ORGANIZATION_NAME}:{' '}
              {item.requiresConfirmation
                ? 'Not shared — review required'
                : 'Permission pending connection'}
            </Text>
            {item.requiresConfirmation && enabled && (
              <TextButton
                onPress={() => {
                  void review(item)
                }}
              >
                Review sharing
              </TextButton>
            )}
            <TextButton
              tone="danger"
              onPress={() =>
                revoke(item.organizationId, item.grant.submissionId)
              }
            >
              Cancel sharing permission
            </TextButton>
          </View>
        ) : null,
      )}
      {!submissionId &&
        organizations.map(([id, name]) => (
          <TextButton
            key={id}
            tone="danger"
            onPress={() => revoke(id)}
          >{`Revoke all access for ${name}`}</TextButton>
        ))}
      {pending
        .filter((item) => item.action !== 'grant')
        .map((item) => (
          <Text key={item.mutationId} style={styles.body}>
            Revocation pending connection. Access is revoked when the server
            acknowledges it.
          </Text>
        ))}
      {pending.length > 0 && (
        <TextButton
          onPress={() => {
            void useOrganizationSharingStore.getState().sync(uid)
          }}
        >
          Retry permission sync
        </TextButton>
      )}
      {!!message && <Text style={styles.hint}>{message}</Text>}
    </GlassSurface>
  )
}
