/**
 * hooks/useEntryGate.ts
 * The app-wide gate Home runs: send a new device to the intro flow and a
 * signed-out user to sign-in.
 */

import { hasAcceptedConsent } from '@/src/hooks/useConsentStore'
import { useAuth } from '@/src/lib/auth/useAuth'
import { router } from 'expo-router'
import { useEffect } from 'react'

export function useEntryGate(): void {
  const { isAuthenticated, isReady } = useAuth()
  // No device consent yet → intro flow (onboarding leads into consent);
  // consent already accepted but not signed in → sign-in; otherwise stay.
  // Consent is checked first so a consented-but-signed-out user (e.g. after
  // logging out) never sees intro-flow/consent again — that gate is granted
  // for the device, not the session. Never act while !isReady — auth state
  // is indeterminate until the provider has reported at least once, and
  // redirecting on a guess is what caused #93's loop.
  useEffect(() => {
    if (!isReady) return
    if (!hasAcceptedConsent()) {
      router.replace('/intro-flow')
    } else if (!isAuthenticated) {
      router.replace('/sign-in')
    }
  }, [isReady, isAuthenticated])
}
