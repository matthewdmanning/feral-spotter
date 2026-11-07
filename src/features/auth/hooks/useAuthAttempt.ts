/**
 * hooks/useAuthAttempt.ts
 * One sign-in or registration attempt: busy state, one attempt at a time,
 * then the consent flow on success or an alert on failure.
 */

import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'

export interface AuthFailureCopy {
  /** Console tag, e.g. '[sign-in] email'. */
  tag: string
  title: string
  message: string
}

// A user dismissing a provider sheet is not a failure — don't alert.
const isCancellation = (err: unknown) =>
  err instanceof Error && err.message === 'SIGN_IN_CANCELLED'

export function useAuthAttempt(): {
  busy: boolean
  attempt: (
    run: () => Promise<unknown>,
    failure: AuthFailureCopy,
  ) => Promise<void>
} {
  const [busy, setBusy] = useState(false)
  // A ref, not `busy`: two taps in one frame both see busy === false.
  const running = useRef(false)

  const attempt = useCallback(
    async (run: () => Promise<unknown>, failure: AuthFailureCopy) => {
      if (running.current) return
      running.current = true
      setBusy(true)
      try {
        await run()
        router.replace(nextConsentRoute())
      } catch (err) {
        if (isCancellation(err)) return
        console.error(`${failure.tag} failed:`, err)
        showAlert(failure.title, failure.message)
      } finally {
        running.current = false
        setBusy(false)
      }
    },
    [],
  )

  return { busy, attempt }
}
