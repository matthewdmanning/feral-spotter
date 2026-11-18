import { Fragment as ReactFragment, useState, useEffect, useRef } from 'react'
import { Pressable } from 'react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import { randomUUID } from 'expo-crypto'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { CheckboxBox } from '@/src/shared/ui/atoms/CheckboxBox'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import {
  DEFAULT_SHARING,
  SHARING_FIELD_KEYS,
} from '@/src/shared/types/Organizations'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import {
  organizationRequest,
  isRequestCancelled,
} from '@/src/features/organizations/lib/api'
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
  const copy = organizationCopy.leave
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
  const pendingReview = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      pendingReview.current?.abort()
    },
    [],
  )
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
      <Text style={styles.body}>{copy.disclosure}</Text>
      {checkbox(copy.keep, keep, () => {
        setKeep(!keep)
        reset()
      })}
      {keep && (
        <>
          <Text style={styles.hint}>{copy.retainedDisclosure}</Text>
          {checkbox(organizationCopy.submission.anonymous, anonymous, () => {
            setAnonymous(!anonymous)
            reset()
          })}
          {SHARING_FIELD_KEYS.map((key) => (
            <ReactFragment key={key}>
              {checkbox(
                organizationCopy.sharingSettings.shareFieldLabels[key],
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
              label={organizationCopy.sharingSettings.nameField}
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
              label={organizationCopy.sharingSettings.phoneField}
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
              {formatCopy(organizationCopy.sharingSettings.emailValue, {
                email:
                  email ?? organizationCopy.sharingSettings.emailUnavailable,
              })}
            </Text>
          )}
          <Text style={styles.hint}>
            {anonymous ? copy.anonymousDisclosure : copy.contactDisclosure}
          </Text>
          {!reviewed && (
            <AppButton
              disabled={busy}
              loading={loading}
              onPress={() => {
                if (pendingReview.current) return
                const controller = new AbortController()
                pendingReview.current = controller
                setLoading(true)
                setError('')
                void organizationRequest<{
                  catalogVersion: string
                  epoch: number
                  shareCount: number
                }>({ action: 'reviewLeaving', organizationId }, uid, {
                  signal: controller.signal,
                })
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
                  .catch((error) => {
                    if (!isRequestCancelled(error)) setError(copy.reviewFailed)
                  })
                  .finally(() => {
                    if (pendingReview.current === controller) {
                      pendingReview.current = null
                      if (!controller.signal.aborted) setLoading(false)
                    }
                  })
              }}
            >
              {copy.review}
            </AppButton>
          )}
          {reviewed && review && (
            <Text style={styles.body}>
              {formatCopy(copy.reviewSummary, { count: review.shareCount })}
            </Text>
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
              setError(copy.incomplete)
              setReview(null)
              setChoice(null)
            }
          })
        }}
      >
        {keep ? copy.confirmKeep : copy.confirmRevoke}
      </AppButton>
    </>
  )
}
