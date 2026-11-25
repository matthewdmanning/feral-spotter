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
import {
  RecentSignInRequiredError,
  deleteAccountOnServer,
  wipeDeviceData,
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
      try {
        setStep('deleting')
        try {
          await authProvider.reauthenticate(typedPassword)
          if (authProvider.getCurrentUser()?.uid !== uid) {
            close()
            return
          }
          closePostHogClient()
          await deleteAccountOnServer(uid, deleteSightings)
        } catch (error) {
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
          if (WRONG_PASSWORD_CODES.includes(code)) {
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
        const activeUid = authProvider.getCurrentUser()?.uid
        if (activeUid && activeUid !== uid) {
          close()
          return
        }
        // The account is gone; whatever fails below must not keep it here.
        await wipeDeviceData()
        queryClient.clear()
        await authProvider.signOut().catch(() => undefined)
        close()
        startOver('/intro-flow')
        showSuccess(
          accountDeletionCopy.deletedTitle,
          accountDeletionCopy.deletedMessage,
        )
      } finally {
        running.current = false
      }
    },
    [close, deleteSightings, queryClient],
  )

  const usesPassword = authProvider.signInMethod() === 'password'
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
