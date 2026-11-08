/**
 * test-utils/consent.ts
 * Sets device consent on the real store, so hasAcceptedConsent() reads it.
 */

import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'

export function setConsent(accepted: boolean): void {
  useConsentStore.setState({
    accepted,
    acceptedVersion: accepted ? CONSENT_VERSION : null,
  })
}
