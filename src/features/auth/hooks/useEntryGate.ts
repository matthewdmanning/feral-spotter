/**
 * features/auth/hooks/useEntryGate.ts
 * The app-wide gate the tab layout runs: send a new device to the intro
 * flow, a signed-out user to sign-in, and a signed-in user with an unanswered
 * consent step to that step. Returns true once the user may see the tabs:
 * disclosure accepted and signed in. The layout renders no tabs before that,
 * so NativeTabs never sends PRELOAD actions to a navigator the redirect is
 * about to unmount (#495).
 */

import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import {
  hasAcceptedConsent,
  useConsentHydrated,
} from '@/src/shared/consent/useConsentStore'
import { syncAccountConsent } from '@/src/features/auth/lib/accountConsent'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import { router } from 'expo-router'
import { useEffect } from 'react'

export function useEntryGate(): boolean {
  const { user, isReady } = useAuth()
  const uid = user?.uid ?? null
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
  // shown again (email-opt-in.md). Those steps are optional, so they never
  // hold the tabs closed or wait on the network: the tabs open at once and
  // the step is pushed over them once the account's answers are refreshed.
  // A push keeps the tabs mounted, so no PRELOAD reaches a navigator being
  // torn down (#495); the step's last screen pops back to them.
  useEffect(() => {
    if (!isReady || !consentHydrated) return
    if (!hasAcceptedConsent()) {
      router.replace('/intro-flow')
    } else if (uid === null) {
      router.replace('/sign-in')
    } else {
      let current = true
      void syncAccountConsent(uid).then(() => {
        if (!current) return
        const next = nextConsentRoute()
        if (next !== '/(home-tabs)') router.push(next)
      })
      return () => {
        current = false
      }
    }
  }, [isReady, uid, consentHydrated])
  return isReady && consentHydrated && hasAcceptedConsent() && uid !== null
}
