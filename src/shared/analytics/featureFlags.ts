/**
 * shared/analytics/featureFlags.ts
 * Remote feature flags through the PostHog SDK. The SDK only runs inside the
 * consented PostHogProvider (providers/AppProviders.tsx), which registers its
 * client here while mounted. Without it — no release candidate, no consent,
 * no analytics opt-in, no configuration — no flag client exists, and callers
 * fall back to the build flags (FEATURE_FLAGS).
 */

import { create } from 'zustand'
import type { PostHog } from 'posthog-react-native'
import { analyticsAllowed } from '@/src/shared/analytics/analytics'

export interface FlagClient {
  /** Fetches fresh evaluations; the SDK persists them for the next launch. */
  reload: () => Promise<void>
  /** The flag's stored evaluation; undefined when none is available. */
  isEnabled: (key: string) => boolean | undefined
}

interface FlagClientState {
  client: FlagClient | null
}

/** The mounted SDK's flag client. A change re-evaluates every remote flag. */
export const useFlagClientStore = create<FlagClientState>(() => ({
  client: null,
}))

/** The SDK's flags as a FlagClient. Reading a flag sends no event. */
export function posthogFlagClient(posthog: PostHog): FlagClient {
  return {
    reload: () => posthog.reloadFeatureFlagsAsync().then(() => undefined),
    isEnabled: (key) =>
      posthog.getFeatureFlagResult(key, { sendEvent: false })?.enabled,
  }
}

/** Call from a PostHog-wrapped component; pass null when it unmounts. */
export function registerFlagClient(client: FlagClient | null): void {
  useFlagClientStore.setState({ client })
}

/**
 * The flag client, behind the same gate as every capture path. A client left
 * registered after consent is revoked is never asked.
 */
export function flagClient(): FlagClient | null {
  return analyticsAllowed() ? useFlagClientStore.getState().client : null
}
