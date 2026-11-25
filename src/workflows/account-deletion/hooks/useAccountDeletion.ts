/**
 * workflows/account-deletion/hooks/useAccountDeletion.ts
 * The deletion guard's steps (#433): a warning with one "also delete my
 * Sightings" choice, a second warning only when it is chosen, then
 * re-authentication, the server erasure and the device wipe.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { authProvider } from '@/src/features/auth/lib'
import { accountDeletionCopy } from '@/src/features/settings/copy/settingsCopy'
import { reportError } from '@/src/shared/analytics/analytics'
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

  const close = useCallback(() => {
    setStep('closed')
    setDeleteSightings(false)
    setPassword('')
  }, [])

  const run = useCallback(
    async (typedPassword?: string) => {
      setStep('deleting')
      try {
        await authProvider.reauthenticate(typedPassword)
        await deleteAccountOnServer(deleteSightings)
      } catch (error) {
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
    open: () => setStep('warning'),
    close,
    confirmWarning: () =>
      deleteSightings ? setStep('sightingsWarning') : proceed(),
    confirmSightings: proceed,
    submitPassword: () => void run(password),
  }
}
