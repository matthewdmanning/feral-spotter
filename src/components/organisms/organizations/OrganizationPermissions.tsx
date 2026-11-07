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
import { FIELD_LABELS } from './SharingSettings'
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
        setMessage(
          'This organization is no longer available. No permission was granted.',
        )
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
        ? 'Anonymous.'
        : contactValues.length
          ? `Contact: ${contactValues.join(', ')}.`
          : 'No contact information selected.'
      showAlert(
        'Confirm sharing again',
        `${organization.name}: cat count, approximate area${fields.length ? `, ${fields.join(', ')}` : ''}. ${contactSummary} Current coverage will be checked before permission is saved.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share this sighting',
            onPress: async () => {
              const state = useOrganizationSharingStore.getState()
              if (
                !state.reconfirm(uid, item.mutationId, grant, organization.name)
              ) {
                setMessage(
                  'Sharing choices changed. Review this permission again.',
                )
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
        ],
      )
    } catch {
      setMessage('Connect to review the current organization coverage.')
    }
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
      {pending
        .filter((item) => item.action === 'grant')
        .map((item) => (
          <View key={item.mutationId}>
            <Text style={styles.body}>
              {item.organizationName ?? 'Selected organization'}:{' '}
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
                revoke(item.organizationId, item.grant?.submissionId)
              }
            >
              Cancel sharing permission
            </TextButton>
          </View>
        ))}
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
