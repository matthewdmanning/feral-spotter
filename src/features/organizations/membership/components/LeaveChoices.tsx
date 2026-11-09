import { Fragment as ReactFragment, useState } from 'react'
import { Text, Pressable } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { CheckboxBox } from '@/src/shared/ui/atoms/CheckboxBox'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import {
  DEFAULT_SHARING,
  SHARING_FIELD_KEYS,
  SHARING_FIELD_LABELS,
} from '@/src/shared/types/Organizations'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { organizationRequest } from '@/src/features/organizations/lib/api'
import { styles } from '@/src/features/organizations/components/styles'
import type { LeaveChoice } from '@/functions/src/organizations/membership/domain'

export function LeaveChoices({
  uid,
  organizationId,
  busy,
  onLeave,
}: {
  uid: string
  organizationId: string
  busy: boolean
  onLeave: (choice: LeaveChoice) => Promise<boolean>
}) {
  const saved =
    useOrganizationSharingStore.getState().accounts[uid]?.settings ??
    DEFAULT_SHARING
  const [settings, setSettings] = useState(() => ({
    ...saved,
    fields: { ...saved.fields },
  }))
  const [keep, setKeep] = useState(false)
  const [anonymous, setAnonymous] = useState(true)
  const [review, setReview] = useState<{
    catalogVersion: string
    epoch: number
    shareCount: number
  } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [choice, setChoice] = useState<LeaveChoice | null>(null)
  const email = useAuthStore((s) => s.user?.email)
  const reviewed = review && choice?.contactEmail === (email ?? null)
  const reset = () => {
    setReview(null)
    setChoice(null)
    setError('')
  }
  const checkbox = (label: string, checked: boolean, change: () => void) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: busy || loading }}
      disabled={busy || loading}
      style={styles.checkRow}
      onPress={change}
    >
      <CheckboxBox checked={checked} />
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  )
  return (
    <>
      <Text style={styles.body}>
        Leaving unshares all your Sightings from this organization by default.
        Copies already received cannot be recalled.
      </Text>
      {checkbox('Keep sharing my existing Sightings', keep, () => {
        setKeep(!keep)
        reset()
      })}
      {keep && (
        <>
          <Text style={styles.hint}>
            Choose again for all existing shares. Cat count and approximate area
            remain included. Future Sightings are not shared automatically.
          </Text>
          {checkbox('Anonymous', anonymous, () => {
            setAnonymous(!anonymous)
            reset()
          })}
          {SHARING_FIELD_KEYS.map((key) => (
            <ReactFragment key={key}>
              {checkbox(
                `Share ${SHARING_FIELD_LABELS[key].toLowerCase()}`,
                settings.fields[key],
                () => {
                  setSettings({
                    ...settings,
                    fields: {
                      ...settings.fields,
                      [key]: !settings.fields[key],
                    },
                  })
                  reset()
                },
              )}
            </ReactFragment>
          ))}
          {settings.fields.name && !anonymous && (
            <TextField
              label="Name to share"
              value={settings.name}
              maxLength={200}
              editable={!busy && !loading}
              onChangeText={(name) => {
                setSettings({ ...settings, name })
                reset()
              }}
            />
          )}
          {settings.fields.phone && !anonymous && (
            <TextField
              label="Phone to share"
              value={settings.phone}
              maxLength={50}
              editable={!busy && !loading}
              keyboardType="phone-pad"
              onChangeText={(phone) => {
                setSettings({ ...settings, phone })
                reset()
              }}
            />
          )}
          {settings.fields.email && !anonymous && (
            <Text style={styles.body}>
              Email to share: {email ?? 'No email available'}
            </Text>
          )}
          <Text style={styles.hint}>
            {anonymous
              ? 'Anonymous overrides name, email, and phone.'
              : 'Selected contact fields are shared with the organization; member views exclude contact information.'}
          </Text>
          {!reviewed && (
            <AppButton
              disabled={busy}
              loading={loading}
              onPress={() => {
                setLoading(true)
                setError('')
                void organizationRequest<{
                  catalogVersion: string
                  epoch: number
                  shareCount: number
                }>({ action: 'reviewLeaving', organizationId }, uid)
                  .then((result) => {
                    setReview(result)
                    setChoice({
                      mode: 'keep',
                      mutationId: randomUUID(),
                      ...result,
                      settings,
                      anonymous,
                      contactEmail: email ?? null,
                    })
                  })
                  .catch(() =>
                    setError(
                      'Unable to review current shares. Retry or leave and unshare everything.',
                    ),
                  )
                  .finally(() => setLoading(false))
              }}
            >
              Review retained sharing
            </AppButton>
          )}
          {reviewed && review && (
            <Text
              style={styles.body}
            >{`Confirm these choices for ${review.shareCount} existing Sightings before leaving.`}</Text>
          )}
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
      <AppButton
        variant={keep ? 'primary' : 'danger'}
        disabled={busy || loading || (keep && !reviewed)}
        onPress={() => {
          const submitted = choice ?? {
            mode: 'revoke' as const,
            mutationId: randomUUID(),
          }
          setChoice(submitted)
          void onLeave(submitted).then((success) => {
            if (!success) {
              setError(
                'Leaving is incomplete. Refresh memberships and resume if a leave operation is pending.',
              )
              setReview(null)
              setChoice(null)
            }
          })
        }}
      >
        {keep
          ? 'Confirm sharing and leave'
          : 'Leave and unshare all my Sightings'}
      </AppButton>
    </>
  )
}
