/**
 * hooks/useConsentStore.ts
 * Persisted Zustand store for onboarding + consent state.
 *
 * Tracks:
 *  - data usage agreement acceptance (timestamped; required before submission)
 *  - per-permission primer decisions (granted / declined / deferred)
 *  - onboarding completion (gates first-run flow in root layout)
 *
 * Primer decisions mirror — but do not replace — OS permission state.
 * Always re-check the OS permission at point of use; this store records
 * the user's choice history for gating, re-priming, and audit.
 */

import type { PrimerKey } from "@/src/config/onboardingCopy";
import { asyncStorage } from "@/src/lib/cache/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrimerStatus = "pending" | "granted" | "declined" | "deferred";

export interface PrimerRecord {
  status: PrimerStatus;
  decidedAt: string | null; // ISO 8601
}

interface ConsentState {
  /** ISO timestamp of T3 data-usage-agreement acceptance; null = not accepted. */
  dataAgreementAcceptedAt: string | null;
  /** First-run flow (tutorial + primer sequence) completed. */
  onboardingCompleted: boolean;
  primers: Record<PrimerKey, PrimerRecord>;

  acceptDataAgreement: () => void;
  setPrimerStatus: (key: PrimerKey, status: PrimerStatus) => void;
  completeOnboarding: () => void;
}

const DEFAULT_PRIMERS: Record<PrimerKey, PrimerRecord> = {
  location: { status: "pending", decidedAt: null },
  camera: { status: "pending", decidedAt: null },
  photo_library: { status: "pending", decidedAt: null },
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      dataAgreementAcceptedAt: null,
      onboardingCompleted: false,
      primers: { ...DEFAULT_PRIMERS },

      acceptDataAgreement: () =>
        set({ dataAgreementAcceptedAt: new Date().toISOString() }),

      setPrimerStatus: (key, status) =>
        set((state) => ({
          primers: {
            ...state.primers,
            [key]: { status, decidedAt: new Date().toISOString() },
          },
        })),

      completeOnboarding: () => set({ onboardingCompleted: true }),
    }),
    {
      name: "consent-store",
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
