/**
 * hooks/useConsentStore.ts
 * Persisted, reactive record of the data-collection disclosure acceptance
 * (src/screens/consent/). Anything that collects or transmits the data
 * described in that disclosure — photos, location, entered details —
 * must gate on `hasAcceptedConsent()` (plain check) or the `accepted` field
 * (reactive, for components/providers) rather than assuming the consent
 * screen was shown.
 *
 * Analytics is a separate, narrower opt-in captured on its own screen
 * (src/screens/analytics-consent/): it defaults to denied and is only
 * enabled via `setAnalyticsAccepted(true)`, independent of `markAccepted()`.
 * Gate analytics on `hasAcceptedAnalytics()`/`analyticsAccepted` in addition
 * to (not instead of) the overall consent check.
 *
 * Email updates are a third, separate opt-in (src/screens/email-opt-in/,
 * asked before the analytics screen; changeable in Settings). It defaults to
 * off and is only enabled via `setEmailOptIn(true)`. It is not part of the
 * data-collection disclosure, so declining never blocks the app.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const CONSENT_VERSION = 1 // bump when disclosure copy changes materially

interface ConsentState {
  accepted: boolean
  acceptedVersion: number | null
  analyticsAccepted: boolean
  emailOptIn: boolean
  markAccepted: () => void
  setAnalyticsAccepted: (enabled: boolean) => void
  setEmailOptIn: (enabled: boolean) => void
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      accepted: false,
      acceptedVersion: null,
      analyticsAccepted: false,
      emailOptIn: false,
      markAccepted: () =>
        set({
          accepted: true,
          acceptedVersion: CONSENT_VERSION,
        }),
      setAnalyticsAccepted: (enabled) =>
        set({
          analyticsAccepted: enabled,
        }),
      setEmailOptIn: (enabled) => set({ emailOptIn: enabled }),
    }),
    {
      name: 'consent-store',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
)

/** Plain (non-hook) check for use outside React components, e.g. utils/analytics.ts. */
export function hasAcceptedConsent(): boolean {
  const { accepted, acceptedVersion } = useConsentStore.getState()
  return accepted && acceptedVersion === CONSENT_VERSION
}

/** Plain (non-hook) check for use outside React components, e.g. utils/analytics.ts. */
export function hasAcceptedAnalytics(): boolean {
  return useConsentStore.getState().analyticsAccepted
}

/** Plain (non-hook) check for use outside React components. */
export function hasOptedInToEmail(): boolean {
  return useConsentStore.getState().emailOptIn
}
