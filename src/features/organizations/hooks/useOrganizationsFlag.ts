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
 * With data and analytics consent, the PostHog rollout decides, even against
 * the build flag. The build flag is the default for everything else: no
 * consent, no PostHog configuration, or no usable evaluation. The request
 * never starts the analytics SDK or sends capture/identify events.
 */
export const useOrganizationsFlag = create<FlagState>((set) => ({
  enabled: FEATURE_FLAGS.organizations,
  pinInteractionsEnabled: false,
  refresh: () => {
    if (inFlight) return inFlight
    inFlight = (async () => {
      // PostHog is not asked, or gives no answer: the build flag decides.
      const fallback = {
        enabled: FEATURE_FLAGS.organizations,
        pinInteractionsEnabled: false,
      }
      try {
        if (!hasAcceptedConsent() || !hasAcceptedAnalytics()) {
          set(fallback)
          return
        }
        const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as
          string | undefined
        const host = Constants.expoConfig?.extra?.posthogHost as
          string | undefined
        if (!apiKey || !host) {
          set(fallback)
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
        let before = fallback
        if (cached) {
          try {
            const previous = JSON.parse(cached) as {
              enabled: boolean
              pinInteractionsEnabled?: boolean
              checkedAt: number
            }
            // A fresh cached evaluation, on or off, stands in until the reply.
            if (
              typeof previous.enabled === 'boolean' &&
              previous.checkedAt <= Date.now() &&
              Date.now() - previous.checkedAt < 24 * 60 * 60 * 1000
            )
              before = {
                enabled: previous.enabled,
                pinInteractionsEnabled:
                  previous.enabled && previous.pinInteractionsEnabled === true,
              }
          } catch {
            /* Ignore a corrupt cache and still request the current flag. */
          }
        }
        set(before)
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
        // An unusable evaluation says nothing about the rollout.
        if (!result?.flags || result.errorsWhileComputingFlags === true) {
          set(fallback)
          return
        }
        const enabled = result.flags.Organizations?.enabled === true
        const pinInteractionsEnabled =
          enabled && result.flags.PinInteractions?.enabled === true
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
        /* Offline, a fresh cached evaluation or the build flag stays in effect. */
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
