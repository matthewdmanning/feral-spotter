import { create } from 'zustand'
import Constants from 'expo-constants'
import { randomUUID } from 'expo-crypto'
import { asyncStorage } from '@/src/shared/lib/storage'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import {
  hasAcceptedAnalytics,
  hasAcceptedConsent,
} from '@/src/shared/consent/useConsentStore'

interface FlagState {
  enabled: boolean
  pinInteractionsEnabled: boolean
  refresh: () => Promise<void>
}
let inFlight: Promise<void> | null = null
/**
 * The build flag is the master gate: off keeps Organizations off. On, the
 * PostHog rollout decides, asked only after data and analytics consent;
 * without both, Organizations stays off. The request never starts the
 * analytics SDK or sends capture/identify events.
 */
export const useOrganizationsFlag = create<FlagState>((set) => ({
  enabled: false,
  pinInteractionsEnabled: false,
  refresh: () => {
    if (inFlight) return inFlight
    inFlight = (async () => {
      try {
        if (
          !FEATURE_FLAGS.organizations ||
          !hasAcceptedConsent() ||
          !hasAcceptedAnalytics()
        ) {
          set({ enabled: false, pinInteractionsEnabled: false })
          return
        }
        const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as
          string | undefined
        const host = Constants.expoConfig?.extra?.posthogHost as
          string | undefined
        if (!apiKey || !host) {
          set({ enabled: false, pinInteractionsEnabled: false })
          return
        }
        let distinctId = await asyncStorage.getItem(
          'organizations-flag-installation',
        )
        if (!distinctId) {
          distinctId = randomUUID()
          await asyncStorage.setItem(
            'organizations-flag-installation',
            distinctId,
          )
        }
        const cached = await asyncStorage.getItem('organizations-flag-v1')
        let cachedEnabled = false
        let cachedInteractionsEnabled = false
        if (cached) {
          try {
            const previous = JSON.parse(cached) as {
              enabled: boolean
              pinInteractionsEnabled?: boolean
              checkedAt: number
            }
            cachedEnabled =
              previous.enabled === true &&
              previous.checkedAt <= Date.now() &&
              Date.now() - previous.checkedAt < 24 * 60 * 60 * 1000
            cachedInteractionsEnabled =
              cachedEnabled && previous.pinInteractionsEnabled === true
          } catch {
            /* Ignore a corrupt cache and still request the current flag. */
          }
        }
        set({
          enabled: cachedEnabled,
          pinInteractionsEnabled: cachedInteractionsEnabled,
        })
        const response = await fetch(`${host.replace(/\/$/, '')}/flags/?v=2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: apiKey,
            distinct_id: distinctId,
            geoip_disable: true,
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw new Error('Flag evaluation failed')
        const result = (await response.json().catch(() => null)) as {
          flags?: Record<string, { enabled?: boolean }>
          errorsWhileComputingFlags?: boolean
        } | null
        const enabled =
          result?.errorsWhileComputingFlags !== true &&
          result?.flags?.Organizations?.enabled === true
        const pinInteractionsEnabled =
          enabled && result?.flags?.PinInteractions?.enabled === true
        set({ enabled, pinInteractionsEnabled })
        await asyncStorage.setItem(
          'organizations-flag-v1',
          JSON.stringify({
            enabled,
            pinInteractionsEnabled,
            checkedAt: Date.now(),
          }),
        )
      } catch {
        /* Fresh cached evaluation remains usable offline; initial state is off. */
      }
    })().finally(() => {
      inFlight = null
    })
    return inFlight
  },
}))

/** Whether Organizations is on for this install. Gate screens and routes on this. */
export function useOrganizationsEnabled() {
  return useOrganizationsFlag((state) => state.enabled)
}

/** Pin interactions require both their own rollout and organization sharing. */
export function usePinInteractionsFlag() {
  return useOrganizationsFlag(
    (state) => state.enabled && state.pinInteractionsEnabled,
  )
}
