/**
 * workflows/account-deletion/hooks/useAccountDeletion.ts
 * The deletion guard's steps (#433): a warning with one "also delete my
 * Sightings" choice, a second warning only when it is chosen, then
 * re-authentication, the server erasure and the device wipe.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { authProvider } from '@/src/features/auth/lib'
import { accountDeletionCopy } from '@/src/features/settings/copy/settingsCopy'
import { reportError } from '@/src/shared/analytics/analytics'
import {
  closePostHogClient,
  resumePostHogClient,
} from '@/src/shared/analytics/posthogClient'
import { authCopy } from '@/src/shared/config/text'
import { showError, showSuccess } from '@/src/shared/hooks/useUIStore'
import { startOver } from '@/src/shared/lib/navigation'
import { setPendingDeletion } from '@/src/shared/lib/pendingDeletion'
import {
  AmbiguousDeletionError,
  RecentSignInRequiredError,
  completeAccountDeletion,
  deleteAccountOnServer,
  reconcileDeletion,
} from '@/src/workflows/account-deletion/lib/accountDeletion'

export type AccountDeletionStep =
  'closed' | 'warning' | 'sightingsWarning' | 'password' | 'deleting'

const WRONG_PASSWORD_CODES = ['auth/wrong-password', 'auth/invalid-credential']

const isCancellation = (error: unknown) =>
  error instanceof Error && error.message === 'SIGN_IN_CANCELLED'

export function useAccountDeletion() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<AccountDeletionStep>('closed')
  const [deleteSightings, setDeleteSightings] = useState(false)
  const [password, setPassword] = useState('')
  const running = useRef(false)
  const usesPassword = authProvider.signInMethod() === 'password'
  const targetUid = useRef<string | null>(null)

  const close = useCallback(() => {
    targetUid.current = null
    setStep('closed')
    setDeleteSightings(false)
    setPassword('')
  }, [])

  const run = useCallback(
    async (typedPassword?: string) => {
      const uid = targetUid.current
      if (running.current) return
      if (!uid || authProvider.getCurrentUser()?.uid !== uid) {
        close()
        return
      }
      running.current = true
      const pending = { uid, deleteSightings, phase: 'requested' as const }
      try {
        setStep('deleting')
        let outcome: 'deleted' | 'exists' | 'unknown' = 'deleted'
        try {
          await authProvider.reauthenticate(typedPassword)
          if (authProvider.getCurrentUser()?.uid !== uid) {
            close()
            return
          }
          closePostHogClient()
          // Before the request: a lost answer must be resumed, not forgotten.
          setPendingDeletion(pending)
          try {
            await deleteAccountOnServer(uid, deleteSightings)
          } catch (error) {
            if (!(error instanceof AmbiguousDeletionError)) throw error
            outcome = await reconcileDeletion(uid)
          }
        } catch (error) {
          setPendingDeletion(null)
          if (authProvider.getCurrentUser()?.uid !== uid) {
            close()
            return
          }
          resumePostHogClient(uid)
          if (isCancellation(error)) {
            close()
            return
          }
          const code = (error as { code?: string }).code ?? ''
          // A provider's own failure stays in the provider flow.
          if (usesPassword && WRONG_PASSWORD_CODES.includes(code)) {
            setPassword('')
            setStep('password')
            showError(
              accountDeletionCopy.failedTitle,
              accountDeletionCopy.wrongPasswordMessage,
            )
            return
          }
          close()
          reportError('[accountDeletion] delete', error)
          showError(
            accountDeletionCopy.failedTitle,
            error instanceof RecentSignInRequiredError
              ? accountDeletionCopy.recentSignInMessage
              : authCopy.retryMessage,
          )
          return
        }
        if (outcome === 'exists') {
          setPendingDeletion(null)
          resumePostHogClient(uid)
          close()
          showError(accountDeletionCopy.failedTitle, authCopy.retryMessage)
          return
        }
        if (outcome === 'unknown') {
          // Kept: AccountDeletionRuntime checks again; analytics stays off.
          close()
          showError(
            accountDeletionCopy.failedTitle,
            accountDeletionCopy.unconfirmedMessage,
          )
          return
        }
        const activeUid = authProvider.getCurrentUser()?.uid
        if (activeUid && activeUid !== uid) {
          close()
          return
        }
        // The account is gone; whatever fails below must not keep it here.
        const wiped = await completeAccountDeletion(pending)
        queryClient.clear()
        close()
        startOver('/intro-flow')
        if (wiped) {
          showSuccess(
            accountDeletionCopy.deletedTitle,
            accountDeletionCopy.deletedMessage,
          )
        } else {
          showError(
            accountDeletionCopy.deletedTitle,
            accountDeletionCopy.cleanupPendingMessage,
          )
        }
      } finally {
        running.current = false
      }
    },
    [close, deleteSightings, queryClient, usesPassword],
  )

  const proceed = useCallback(() => {
    if (usesPassword) setStep('password')
    else void run()
  }, [run, usesPassword])

  return {
    step,
    usesPassword,
    deleteSightings,
    setDeleteSightings,
    password,
    setPassword,
    open: () => {
      targetUid.current = authProvider.getCurrentUser()?.uid ?? null
      if (targetUid.current) setStep('warning')
    },
    close,
    confirmWarning: () =>
      deleteSightings ? setStep('sightingsWarning') : proceed(),
    confirmSightings: proceed,
    submitPassword: () => void run(password),
  }
}
