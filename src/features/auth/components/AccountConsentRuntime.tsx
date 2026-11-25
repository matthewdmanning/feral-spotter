/**
 * features/auth/components/AccountConsentRuntime.tsx
 * Keeps consent choices scoped to the signed-in account and its queued
 * choices on their way to the server (ADR-0009). Mounted once by
 * AppProviders. Sign-in also awaits syncAccountConsent itself, so it can
 * route on restored answers. Concurrent callers share a restore attempt.
 */

import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  flushConsentRecords,
  syncAccountConsent,
} from '@/src/features/auth/lib/accountConsent'
import {
  useConsentHydrated,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'

function flush(uid: string) {
  flushConsentRecords(uid).catch((error) =>
    console.warn('[accountConsent] send', error),
  )
}

export function AccountConsentRuntime() {
  const uid = useAuthStore((s) => s.user?.uid ?? null)
  const authReady = useAuthStore((s) => s.isReady)
  const consentHydrated = useConsentHydrated()
  const pending = useConsentStore((s) => s.pendingRecords.length)
  const isOnline = useUIStore((s) => s.isOnline)
  const boundUid = useConsentStore((s) => s.choicesUid)

  // Never bind before both stores know their state: an unread consent
  // store or an unreported session would clear real choices.
  useEffect(() => {
    if (!authReady || !consentHydrated) return
    void syncAccountConsent(uid)
  }, [authReady, consentHydrated, uid])

  useEffect(() => {
    if (!uid || boundUid !== uid || pending === 0 || !isOnline) return
    flush(uid)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush(uid)
    })
    return () => subscription.remove()
  }, [uid, boundUid, pending, isOnline])

  return null
}
