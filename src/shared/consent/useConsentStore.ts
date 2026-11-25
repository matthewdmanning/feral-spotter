/**
 * shared/consent/useConsentStore.ts
 * Persisted, reactive record of the data-collection disclosure acceptance
 * (src/features/permissions/screens/consent/). Anything that collects or transmits the data
 * described in that disclosure — photos, location, entered details —
 * must gate on `hasAcceptedConsent()` (plain check) or both `accepted` and
 * `acceptedVersion === CONSENT_VERSION` (reactive, for components/providers)
 * rather than assuming the consent screen was shown.
 *
 * Analytics is a separate, narrower opt-in captured on its own screen
 * (src/features/permissions/screens/analytics-consent/): it is `null` until answered, counts as denied, and is only
 * enabled via `setAnalyticsAccepted(true)`, independent of `markAccepted()`.
 * Gate analytics on `hasAcceptedAnalytics()`/`analyticsAccepted` in addition
 * to (not instead of) the overall consent check.
 *
 * Email updates are a third, separate opt-in (src/features/permissions/screens/email-opt-in/,
 * asked before the analytics screen; changeable in Settings). It is `null`
 * until the user answers, then true/false; only `setEmailOptIn(true)` enables it.
 * It is not part of the
 * data-collection disclosure, so declining never blocks the app.
 *
 * Scope (ADR-0009): the disclosure is accepted before sign-in and belongs to
 * the device. Analytics and email choices belong to the account in
 * `choicesUid`: `bindChoicesTo` clears them when another account (or none)
 * is signed in, so one account never inherits another's choices. Every
 * choice is also queued in `pendingRecords` for the server's consent
 * records (features/auth/lib/accountConsent.ts), which keep proof of it and
 * restore it on a new device.
 */

import { asyncStorage } from '@/src/shared/lib/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useSyncExternalStore } from 'react'

export const CONSENT_VERSION = 2 // v2 explains background photo uploads and account-linked data

export type ConsentKind = 'data_collection' | 'analytics' | 'email_updates'

/** One choice awaiting the server's consent records. */
export interface ConsentRecord {
  kind: ConsentKind
  granted: boolean
  version: number
  /** ISO 8601, device clock. */
  chosenAt: string
}

/** Account choices as the server returns them. */
export type ConsentChoices = Partial<
  Record<'analytics' | 'email_updates', { granted: boolean }>
>

/**
 * Choices saved before they were scoped to an account. The first account
 * bound adopts them, so an upgrade does not re-ask its signed-in user.
 */
export const LEGACY_CHOICES_UID = '__legacy__'

/** Unsent records past this are dropped oldest first. */
export const MAX_PENDING_RECORDS = 50

interface ConsentState {
  accepted: boolean
  acceptedVersion: number | null
  /** When the current disclosure version was accepted (ISO 8601). */
  acceptedAt: string | null
  analyticsAccepted: boolean | null
  emailOptIn: boolean | null
  /** The account the analytics and email choices belong to. */
  choicesUid: string | null
  activeUid: string | null
  pendingRecords: ConsentRecord[]
  markAccepted: () => void
  setAnalyticsAccepted: (enabled: boolean) => void
  setEmailOptIn: (enabled: boolean) => void
  /** Scope account choices to `uid` (null: signed out). */
  bindChoicesTo: (uid: string | null) => void
  /** Fill choices still unanswered for `uid` from its server records. */
  restoreChoices: (uid: string, choices: ConsentChoices) => void
  /** Acknowledge this record even if the queue moved while it was sending. */
  acknowledgeRecord: (record: ConsentRecord) => void
}

const record = (kind: ConsentKind, granted: boolean, chosenAt?: string) => ({
  kind,
  granted,
  version: CONSENT_VERSION,
  chosenAt: chosenAt ?? new Date().toISOString(),
})

const queue = (pending: ConsentRecord[], ...added: ConsentRecord[]) =>
  [...pending, ...added].slice(-MAX_PENDING_RECORDS)

/** Record only for a bound account; binding records the rest. */
const bound = (uid: string | null) => uid !== null && uid !== LEGACY_CHOICES_UID

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      accepted: false,
      acceptedVersion: null,
      acceptedAt: null,
      analyticsAccepted: null,
      emailOptIn: null,
      choicesUid: null,
      activeUid: null,
      pendingRecords: [],
      markAccepted: () => {
        const acceptedAt = new Date().toISOString()
        set((s) => ({
          accepted: true,
          acceptedVersion: CONSENT_VERSION,
          acceptedAt,
          pendingRecords: bound(s.choicesUid)
            ? queue(
                s.pendingRecords,
                record('data_collection', true, acceptedAt),
              )
            : s.pendingRecords,
        }))
      },
      setAnalyticsAccepted: (enabled) =>
        set((s) => ({
          analyticsAccepted: enabled,
          pendingRecords: bound(s.choicesUid)
            ? queue(s.pendingRecords, record('analytics', enabled))
            : s.pendingRecords,
        })),
      setEmailOptIn: (enabled) =>
        set((s) => ({
          emailOptIn: enabled,
          pendingRecords: bound(s.choicesUid)
            ? queue(s.pendingRecords, record('email_updates', enabled))
            : s.pendingRecords,
        })),
      bindChoicesTo: (uid) => {
        const s = get()
        if (s.choicesUid === uid) {
          if (s.activeUid !== uid) set({ activeUid: uid })
          return
        }
        const accepted = hasAcceptedConsent()
        const disclosure = accepted
          ? [record('data_collection', true, s.acceptedAt ?? undefined)]
          : []
        if (s.choicesUid === LEGACY_CHOICES_UID && uid !== null) {
          // Adopt: the signed-in user made these choices on this device.
          set({
            choicesUid: uid,
            activeUid: uid,
            pendingRecords: queue(
              [],
              ...disclosure,
              ...(s.analyticsAccepted !== null
                ? [record('analytics', s.analyticsAccepted)]
                : []),
              ...(s.emailOptIn !== null
                ? [record('email_updates', s.emailOptIn)]
                : []),
            ),
          })
          return
        }
        // Another account's unsent records cannot be sent for it any more.
        set({
          choicesUid: uid,
          activeUid: uid,
          analyticsAccepted: null,
          emailOptIn: null,
          pendingRecords: uid === null ? [] : disclosure,
        })
      },
      restoreChoices: (uid, choices) =>
        set((s) => {
          if (s.choicesUid !== uid) return {}
          const analytics = choices?.analytics?.granted
          const email = choices?.email_updates?.granted
          return {
            analyticsAccepted:
              s.analyticsAccepted ??
              (typeof analytics === 'boolean' ? analytics : null),
            emailOptIn:
              s.emailOptIn ?? (typeof email === 'boolean' ? email : null),
          }
        }),
      acknowledgeRecord: (record) =>
        set((s) => ({
          pendingRecords: s.pendingRecords.filter(
            (pending) => pending !== record,
          ),
        })),
    }),
    {
      name: 'consent-store',
      storage: createJSONStorage(() => asyncStorage),
      version: 1,
      // v0 had no account scope: whoever signs in next adopts its choices.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<ConsentState>
        if (version >= 1) return state as ConsentState
        const answered =
          state.analyticsAccepted != null || state.emailOptIn != null
        const migrated: Partial<ConsentState> = {
          ...state,
          acceptedAt: null,
          choicesUid: answered ? LEGACY_CHOICES_UID : null,
          pendingRecords: [],
        }
        return migrated as ConsentState
      },
      partialize: (s) => ({
        accepted: s.accepted,
        acceptedVersion: s.acceptedVersion,
        acceptedAt: s.acceptedAt,
        analyticsAccepted: s.analyticsAccepted,
        emailOptIn: s.emailOptIn,
        choicesUid: s.choicesUid,
        pendingRecords: s.pendingRecords,
      }),
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
  const { activeUid, choicesUid, analyticsAccepted } =
    useConsentStore.getState()
  return (
    activeUid !== null && activeUid === choicesUid && analyticsAccepted === true
  )
}

/**
 * True once the persisted consent choices are read back. Until then every
 * check above reads the defaults, so a gate acting before this sends a
 * consented user back through onboarding.
 */
export function useConsentHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useConsentStore.persist.onFinishHydration(onChange),
    () => useConsentStore.persist.hasHydrated(),
  )
}
