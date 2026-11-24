import { create } from 'zustand'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import {
  flagClient,
  type FlagClient,
} from '@/src/shared/analytics/featureFlags'

interface FlagState {
  enabled: boolean
  pinInteractionsEnabled: boolean
  refresh: () => Promise<void>
}

interface Evaluation {
  enabled: boolean
  pinInteractionsEnabled: boolean
}

/** PostHog is not asked, or gives no answer: the build flag decides. */
const fallback = (): Evaluation => ({
  enabled: FEATURE_FLAGS.organizations,
  pinInteractionsEnabled: false,
})

/** The SDK's stored evaluation, or null when it holds none for Organizations. */
function evaluate(client: FlagClient): Evaluation | null {
  const enabled = client.isEnabled('Organizations')
  if (enabled === undefined) return null
  return {
    enabled,
    pinInteractionsEnabled:
      enabled && client.isEnabled('PinInteractions') === true,
  }
}

let inFlight: Promise<void> | null = null
/**
 * With data and analytics consent, the PostHog rollout decides, even against
 * the build flag. The build flag is the default for everything else: no
 * consent, no PostHog SDK mounted, or no usable evaluation. The SDK's
 * persisted evaluation stands in until a reload answers, so a known rollout
 * holds offline.
 */
export const useOrganizationsFlag = create<FlagState>((set) => ({
  enabled: FEATURE_FLAGS.organizations,
  pinInteractionsEnabled: false,
  refresh: () => {
    if (inFlight) return inFlight
    inFlight = (async () => {
      const client = flagClient()
      if (!client) {
        set(fallback())
        return
      }
      set(evaluate(client) ?? fallback())
      try {
        await client.reload()
        set(evaluate(client) ?? fallback())
      } catch {
        /* Offline: the stored evaluation or the build flag stays in effect. */
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
