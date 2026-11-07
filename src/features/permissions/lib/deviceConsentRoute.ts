/**
 * features/permissions/lib/deviceConsentRoute.ts
 * Where device consent leads. Lives above auth because it reads the signed-in
 * user; the step order itself stays in shared/consent/consentFlow.ts.
 */

import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

/**
 * A user already signed in (consent re-asked after a CONSENT_VERSION bump)
 * goes on to their consent steps or home; sign-in would ask for credentials
 * their session does not need.
 */
export function routeAfterDeviceConsent() {
  return useAuthStore.getState().user ? nextConsentRoute() : '/sign-in'
}
