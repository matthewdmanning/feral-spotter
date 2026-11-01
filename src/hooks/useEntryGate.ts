/**
 * hooks/useEntryGate.ts
 * The app-wide gate Home runs: send a new device to the intro flow, a
 * signed-out user to sign-in, and a signed-in user with an unanswered
 * consent step to that step.
 */

import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import {
  hasAcceptedConsent,
  useConsentHydrated,
} from '@/src/shared/consent/useConsentStore'
import { useAuth } from '@/src/lib/auth/useAuth'
import { router } from 'expo-router'
import { useEffect } from 'react'

export function useEntryGate(): void {
  const { isAuthenticated, isReady } = useAuth()
  const consentHydrated = useConsentHydrated()
  // No device consent yet → intro flow (onboarding leads into consent);
  // consent already accepted but not signed in → sign-in; otherwise stay.
  // Consent is checked first so a consented-but-signed-out user (e.g. after
  // logging out) never sees intro-flow/consent again — that gate is granted
  // for the device, not the session. Never act while !isReady — auth state
  // is indeterminate until the provider has reported at least once, and
  // redirecting on a guess is what caused #93's loop. Never act before the
  // consent store has read its saved state either: until then it reads
  // "not accepted" for everyone.
  //
  // A signed-in user whose chain was cut short (app killed on email
  // opt-in) resumes at the first unanswered step. Answered steps are never
  // shown again (email-opt-in.md).
  useEffect(() => {
    if (!isReady || !consentHydrated) return
    if (!hasAcceptedConsent()) {
      router.replace('/intro-flow')
    } else if (!isAuthenticated) {
      router.replace('/sign-in')
    } else {
      const next = nextConsentRoute()
      if (next !== '/(home-tabs)') router.replace(next)
    }
  }, [isReady, isAuthenticated, consentHydrated])
}
