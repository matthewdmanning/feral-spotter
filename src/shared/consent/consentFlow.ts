/**
 * hooks/consentFlow.ts
 * The one place that orders the consent steps after sign-in or registration.
 * To add, remove or reorder a step, edit CONSENT_STEPS; callers never name the
 * next route themselves.
 */

import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { useAuthStore } from '@/src/lib/auth/authStore'

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

/**
 * Where device consent leads. A user already signed in (consent re-asked
 * after a CONSENT_VERSION bump) goes on to their consent steps or home;
 * sign-in would ask for credentials their session does not need.
 */
export function routeAfterDeviceConsent() {
  return useAuthStore.getState().user ? nextConsentRoute() : '/sign-in'
}
