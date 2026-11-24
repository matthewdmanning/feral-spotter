import { useState, useEffect, useRef } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import { randomUUID } from 'expo-crypto'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { DEFAULT_SHARING } from '@/src/shared/types/Organizations'
import { SharingCheckbox } from '@/src/features/organizations/components/SharingCheckbox'
import { SharingFieldInputs } from '@/src/features/organizations/components/SharingFieldInputs'
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
  const disabled = busy || loading
  return (
    <>
      <Text style={styles.body}>{copy.disclosure}</Text>
      <SharingCheckbox
        label={copy.keep}
        checked={keep}
        disabled={disabled}
        onChange={(value) => {
          setKeep(value)
          reset()
        }}
      />
      {keep && (
        <>
          <Text style={styles.hint}>{copy.retainedDisclosure}</Text>
          <SharingCheckbox
            label={organizationCopy.submission.anonymous}
            checked={anonymous}
            disabled={disabled}
            onChange={(value) => {
              setAnonymous(value)
              reset()
            }}
          />
          <SharingFieldInputs
            settings={settings}
            email={email}
            disabled={disabled}
            hideContact={anonymous}
            onChange={(next) => {
              setSettings(next)
              reset()
            }}
          />
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
