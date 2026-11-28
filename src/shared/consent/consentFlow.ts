/**
 * shared/consent/consentFlow.ts
 * The one place that orders the consent steps after sign-in or registration.
 * To add, remove or reorder a step, edit CONSENT_STEPS; callers never name the
 * next route themselves.
 */

import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import { goHome } from '@/src/shared/lib/navigation'
import { router } from 'expo-router'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'

const CONSENT_STEPS = [
  {
    route: '/email-opt-in',
    // A returning user has already chosen; asking again would reset the choice.
    // With the feature off, the step counts as answered, so it is skipped.
    isAnswered: () =>
      !FEATURE_FLAGS.emailUpdates ||
      useConsentStore.getState().emailOptIn !== null,
  },
  {
    route: '/analytics-consent',
    isAnswered: () => useConsentStore.getState().analyticsAccepted !== null,
  },
] as const

export type ConsentRoute = (typeof CONSENT_STEPS)[number]['route']

/**
 * Leaves a consent step for the next one, or for Home after the last. Home
 * pops back to the tabs when a resumed step was pushed over them, so no
 * second tab navigator mounts; otherwise it takes the step's place.
 */
export function continueConsentChain(after: ConsentRoute): void {
  const next = nextConsentRoute(after)
  if (next === '/(home-tabs)') goHome()
  else router.replace(next)
}

/** The next unanswered consent step after `after` (or from the start), else home. */
export function nextConsentRoute(after?: ConsentRoute) {
  const from = after ? CONSENT_STEPS.findIndex((s) => s.route === after) + 1 : 0
  return (
    CONSENT_STEPS.slice(from).find((s) => !s.isAnswered())?.route ??
    '/(home-tabs)'
  )
}
