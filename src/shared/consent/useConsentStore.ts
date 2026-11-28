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

import { CONSENT_RECORDS_URL } from '@/src/shared/config/constants'
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
  /** ISO 8601, device clock. Evidence only; the server orders by revision. */
  chosenAt: string
  /** The server revision this device had seen when the user chose. */
  basedOnRevision: number
}

/** Account choices as the server returns them, with its revision. */
export type ConsentChoices = Partial<
  Record<'analytics' | 'email_updates', { granted: boolean }>
> & { revision?: number }

type AccountKind = 'analytics' | 'email_updates'
const ACCOUNT_KINDS: readonly AccountKind[] = ['analytics', 'email_updates']

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
  /** Highest server revision seen for `choicesUid`. */
  serverRevision: number
  /**
   * The account whose cached choices were confirmed by the server in this
   * process. Not persisted: a cached grant may have been revoked elsewhere.
   */
  verifiedUid: string | null
  markAccepted: () => void
  setAnalyticsAccepted: (enabled: boolean) => void
  setEmailOptIn: (enabled: boolean) => void
  /** Scope account choices to `uid` (null: signed out). */
  bindChoicesTo: (uid: string | null) => void
  /**
   * Apply `uid`'s server choices: they replace cached ones, except a kind
   * with an unsent local choice. Marks the account verified.
   */
  restoreChoices: (uid: string, choices: ConsentChoices) => void
  /** Record a revision the server reported for `uid`. */
  noteServerRevision: (uid: string, revision: number) => void
  /** Acknowledge this record even if the queue moved while it was sending. */
  acknowledgeRecord: (record: ConsentRecord) => void
}

const record = (
  kind: ConsentKind,
  granted: boolean,
  basedOnRevision: number,
  chosenAt?: string,
): ConsentRecord => ({
  kind,
  granted,
  version: CONSENT_VERSION,
  chosenAt: chosenAt ?? new Date().toISOString(),
  basedOnRevision,
})

const queue = (pending: ConsentRecord[], ...added: ConsentRecord[]) =>
  [...pending, ...added].slice(-MAX_PENDING_RECORDS)

/** Record only for a bound account; binding records the rest. */
const bound = (uid: string | null) => uid !== null

// Zustand never marks the store hydrated when the read fails (storage
// rejects, corrupt JSON, a throwing migrate), so gates would wait forever.
// A failed read settles hydration on the defaults instead: not accepted,
// so the user is asked again. Unknown means denied.
let readFailed = false
const readSettledListeners = new Set<() => void>()

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
      serverRevision: 0,
      verifiedUid: null,
      markAccepted: () => {
        const acceptedAt = new Date().toISOString()
        set((s) => ({
          accepted: true,
          acceptedVersion: CONSENT_VERSION,
          acceptedAt,
          pendingRecords: bound(s.choicesUid)
            ? queue(
                s.pendingRecords,
                record('data_collection', true, s.serverRevision, acceptedAt),
              )
            : s.pendingRecords,
        }))
      },
      setAnalyticsAccepted: (enabled) =>
        set((s) => ({
          analyticsAccepted: enabled,
          pendingRecords: bound(s.choicesUid)
            ? queue(
                s.pendingRecords,
                record('analytics', enabled, s.serverRevision),
              )
            : s.pendingRecords,
        })),
      setEmailOptIn: (enabled) =>
        set((s) => ({
          emailOptIn: enabled,
          pendingRecords: bound(s.choicesUid)
            ? queue(
                s.pendingRecords,
                record('email_updates', enabled, s.serverRevision),
              )
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
          ? [record('data_collection', true, 0, s.acceptedAt ?? undefined)]
          : []
        // Another account's unsent records cannot be sent for it any more.
        set({
          choicesUid: uid,
          activeUid: uid,
          analyticsAccepted: null,
          emailOptIn: null,
          serverRevision: 0,
          verifiedUid: null,
          pendingRecords: uid === null ? [] : disclosure,
        })
      },
      restoreChoices: (uid, choices) =>
        set((s) => {
          if (s.choicesUid !== uid) return {}
          const local = {
            analytics: s.analyticsAccepted,
            email_updates: s.emailOptIn,
          }
          for (const kind of ACCOUNT_KINDS) {
            const server = choices?.[kind]?.granted
            const unsent = s.pendingRecords.some((r) => r.kind === kind)
            if (!unsent && typeof server === 'boolean') local[kind] = server
          }
          const revision = choices?.revision
          return {
            analyticsAccepted: local.analytics,
            emailOptIn: local.email_updates,
            serverRevision:
              typeof revision === 'number'
                ? Math.max(s.serverRevision, revision)
                : s.serverRevision,
            verifiedUid: uid,
          }
        }),
      noteServerRevision: (uid, revision) =>
        set((s) =>
          s.choicesUid === uid && revision > s.serverRevision
            ? { serverRevision: revision }
            : {},
        ),
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
      version: 2,
      // v0 kept analytics and email choices across sign-out, so they have
      // no trustworthy owner: keep the device disclosure, drop the account
      // choices. Sign-in restores the account's own from the server, or
      // asks again. v1 builds could hold such choices adopted by a legacy
      // marker; they are dropped the same way.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<ConsentState>
        if (version >= 2) return state as ConsentState
        const migrated: Partial<ConsentState> = {
          accepted: state.accepted ?? false,
          acceptedVersion: state.acceptedVersion ?? null,
          acceptedAt: state.acceptedAt ?? null,
          analyticsAccepted: null,
          emailOptIn: null,
          choicesUid: null,
          pendingRecords: [],
          serverRevision: 0,
        }
        return migrated as ConsentState
      },
      onRehydrateStorage: () => {
        readFailed = false
        return (_state, error) => {
          if (!error) return
          console.warn('[consent] could not read saved consent', error)
          readFailed = true
          readSettledListeners.forEach((listener) => listener())
        }
      },
      partialize: (s) => ({
        accepted: s.accepted,
        acceptedVersion: s.acceptedVersion,
        acceptedAt: s.acceptedAt,
        analyticsAccepted: s.analyticsAccepted,
        emailOptIn: s.emailOptIn,
        choicesUid: s.choicesUid,
        pendingRecords: s.pendingRecords,
        serverRevision: s.serverRevision,
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
  return analyticsAcceptedFor(useConsentStore.getState())
}

/**
 * The analytics gate on a state snapshot, for selectors too: the active
 * account's own opt-in, confirmed by the server in this process when
 * consent records are configured (a cached grant may have been revoked on
 * another device).
 */
export function analyticsAcceptedFor(
  s: Pick<
    ConsentState,
    'activeUid' | 'choicesUid' | 'analyticsAccepted' | 'verifiedUid'
  >,
  uid: string | null = s.activeUid,
): boolean {
  return (
    uid !== null &&
    s.activeUid === uid &&
    s.choicesUid === uid &&
    s.analyticsAccepted === true &&
    (!CONSENT_RECORDS_URL || s.verifiedUid === uid)
  )
}

/**
 * True once the persisted consent choices are read back, or the read failed
 * (then the defaults stand: not accepted). Until then every check above
 * reads the defaults, so a gate acting before this sends a consented user
 * back through onboarding.
 */
export function useConsentHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const unsubscribe = useConsentStore.persist.onFinishHydration(onChange)
      readSettledListeners.add(onChange)
      return () => {
        unsubscribe()
        readSettledListeners.delete(onChange)
      }
    },
    () => useConsentStore.persist.hasHydrated() || readFailed,
  )
}
