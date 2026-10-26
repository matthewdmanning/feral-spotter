/**
 * hooks/consentFlow.ts
 * The one place that orders the consent steps after sign-in or registration.
 * To add, remove or reorder a step, edit CONSENT_STEPS; callers never name the
 * next route themselves.
 */

import { useConsentStore } from '@/src/hooks/useConsentStore'

const CONSENT_STEPS = [
  {
    route: '/email-opt-in',
    // A returning user has already chosen; asking again would reset the choice.
    isAnswered: () => useConsentStore.getState().emailOptIn !== null,
  },
  {
    route: '/analytics-consent',
    isAnswered: () => useConsentStore.getState().analyticsAccepted !== null,
  },
] as const

export type ConsentRoute = (typeof CONSENT_STEPS)[number]['route']

/** The next unanswered consent step after `after` (or from the start), else home. */
export function nextConsentRoute(after?: ConsentRoute) {
  const from = after ? CONSENT_STEPS.findIndex((s) => s.route === after) + 1 : 0
  return (
    CONSENT_STEPS.slice(from).find((s) => !s.isAnswered())?.route ??
    '/(home-tabs)'
  )
}
