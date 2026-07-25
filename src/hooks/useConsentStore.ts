/**
 * hooks/useConsentStore.ts
 * Persisted, reactive record of the data-collection disclosure acceptance
 * (src/screens/consent/). Anything that collects or transmits the data
 * described in that disclosure — photos, location, entered details —
 * must gate on `hasAcceptedConsent()` (plain check) or the `accepted` field
 * (reactive, for components/providers) rather than assuming the consent
 * screen was shown.
 *
 * Analytics is a separate, narrower opt-in: it defaults to denied and is
 * only enabled if the analytics checkbox was checked at the moment consent
 * was accepted. Gate analytics on `hasAcceptedAnalytics()`/`analyticsAccepted`
 * in addition to (not instead of) the overall consent check.
 */

import { asyncStorage } from "@/src/lib/cache/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const CONSENT_VERSION = 1; // bump when disclosure copy changes materially

interface ConsentState {
  accepted: boolean;
  acceptedVersion: number | null;
  analyticsAccepted: boolean;
  markAccepted: (analyticsEnabled: boolean) => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      accepted: false,
      acceptedVersion: null,
      analyticsAccepted: false,
      markAccepted: (analyticsEnabled) =>
        set({
          accepted: true,
          acceptedVersion: CONSENT_VERSION,
          analyticsAccepted: analyticsEnabled,
        }),
    }),
    {
      name: "consent-store",
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);

/** Plain (non-hook) check for use outside React components, e.g. utils/analytics.ts. */
export function hasAcceptedConsent(): boolean {
  const { accepted, acceptedVersion } = useConsentStore.getState();
  return accepted && acceptedVersion === CONSENT_VERSION;
}

/** Plain (non-hook) check for use outside React components, e.g. utils/analytics.ts. */
export function hasAcceptedAnalytics(): boolean {
  return useConsentStore.getState().analyticsAccepted;
}
