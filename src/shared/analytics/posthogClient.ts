/**
 * shared/analytics/posthogClient.ts
 * The app's one PostHog SDK client, and the identity and screen rules
 * AnalyticsBridge (providers/AppProviders.tsx) applies to it.
 *
 * One client per process. PostHogProvider builds a new client whenever it
 * mounts and never shuts the old one down, so with consent gating the mount,
 * a revoked client kept sending lifecycle and uncaught-exception events, and
 * each re-consent installed another set of global handlers. Here the client
 * is created once and opted out on revocation instead.
 */

import {
  PostHogPersistedProperty,
  type PostHogFetchOptions,
  type PostHogFetchResponse,
} from '@posthog/core'
import { analyticsAllowed } from '@/src/shared/analytics/analytics'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import * as Device from 'expo-device'
import { PostHog, type PostHogOptions } from 'posthog-react-native'

let client: PostHog | null = null
let canSend = (_posthog: PostHog) => true

class ConsentPostHog extends PostHog {
  override fetch(
    url: string,
    options: PostHogFetchOptions,
  ): Promise<PostHogFetchResponse> {
    if (!this.optedOut && canSend(this)) return super.fetch(url, options)
    // The SDK can flush an existing queue and reload flags while opted out.
    // A terminal response also stops the SDK from retrying this request.
    return Promise.resolve(new Response(null, { status: 403 }))
  }
}

function clearEventQueues(posthog: PostHog): void {
  posthog.setPersistedProperty(PostHogPersistedProperty.Queue, null)
  posthog.setPersistedProperty(PostHogPersistedProperty.AiQueue, null)
  posthog.setPersistedProperty(PostHogPersistedProperty.AiCaptureQueue, null)
  posthog.setPersistedProperty(PostHogPersistedProperty.LogsQueue, null)
}

useConsentStore.subscribe((state, previous) => {
  if (
    state.activeUid !== previous.activeUid ||
    (previous.analyticsAccepted === true && !analyticsAllowed())
  ) {
    closePostHogClient()
  }
})

/** Options for the app's client; exported for the SDK-backed tests. */
export const POSTHOG_OPTIONS: Omit<PostHogOptions, 'host'> = {
  // Sessions, opens and backgrounding give retention and crash-free-session
  // context for free; this app sells nothing, so no revenue events.
  captureAppLifecycleEvents: true,
  // Anonymous (signed-out) events create no person profile. The SDK default,
  // pinned so an upgrade cannot change cost or identity semantics silently.
  personProfiles: 'identified_only',
  // Capture unhandled JS exceptions globally. The root ErrorBoundary reports
  // render failures separately, so exclude console capture to avoid React's
  // console logging generating duplicate exceptions. uncaughtExceptions and
  // unhandledRejections are opt-in per key, not deep-merged with defaults:
  // omitting either silently disables it.
  errorTracking: {
    autocapture: {
      uncaughtExceptions: true,
      unhandledRejections: true,
      console: [],
    },
  },
}

/**
 * The client, created on first call and opted back in if a revocation opted
 * it out (opt-out is persisted across launches). Idempotent; call while the
 * analytics gate is open.
 */
export function openPostHogClient(
  apiKey: string,
  host: string,
  options: Omit<PostHogOptions, 'host'> = POSTHOG_OPTIONS,
  allowsRequest: (posthog: PostHog) => boolean = () => true,
): PostHog {
  canSend = allowsRequest
  if (!client) client = new ConsentPostHog(apiKey, { ...options, host })
  // Runs once the SDK has loaded persisted state, ahead of any capture
  // queued after it, so a replayed capture is not dropped as opted out.
  void client.optIn()
  return client
}

/** Stop all sending after consent or the analytics opt-in is revoked. */
export function closePostHogClient(): void {
  const posthog = client
  if (!posthog) return
  void posthog.optOut()
  // Clear immediately if ready and again after a pending storage restore.
  clearEventQueues(posthog)
  void posthog.ready().then(() => {
    if (posthog.optedOut) clearEventQueues(posthog)
  })
}

/**
 * Account deletion (#433): drop this device's identity and unsent events and
 * stop sending. The server erases the person; nothing here may recreate it.
 */
export function forgetPostHogDevice(): void {
  closePostHogClient()
  if (client) resetIdentity(client)
}

/** Resume collection after an unsuccessful deletion attempt. */
export function resumePostHogClient(uid: string): void {
  if (
    client &&
    useConsentStore.getState().activeUid === uid &&
    analyticsAllowed()
  ) {
    void client.optIn()
  }
}

/** Test seam: opt the client out and forget it. */
export function resetPostHogClient(): void {
  void client?.optOut()
  client = null
}

/**
 * Hardware super properties, needed to compare camera performance. PostHog
 * already sends OS and app metadata. `reset()` clears super properties, so
 * this runs again after every reset.
 */
export function registerDeviceProperties(posthog: PostHog): void {
  posthog.register({
    device_model: Device.modelName,
    device_manufacturer: Device.manufacturer,
    is_physical_device: Device.isDevice,
  })
}

function resetIdentity(posthog: PostHog): void {
  posthog.reset([
    PostHogPersistedProperty.InstalledAppBuild,
    PostHogPersistedProperty.InstalledAppVersion,
    PostHogPersistedProperty.OptedOut,
  ])
}

function isIdentified(posthog: PostHog): boolean {
  return posthog.getDistinctId() !== posthog.getAnonymousId()
}

/**
 * Point the client's identity at the signed-in user (Firebase UID), or back
 * to anonymous when signed out. Reads identity from the SDK's persisted
 * state, not from memory: a launch that restores user A's identity and then
 * signs in user B must reset first, or `identify(B)` links B to A's person.
 * An anonymous identity is merged on sign-in, so pre-sign-in events count.
 * UID only: no email or other directly identifying data.
 */
export function syncPostHogIdentity(
  posthog: PostHog,
  uid: string | null,
): void {
  if (uid !== null && posthog.getDistinctId() === uid) return
  if (isIdentified(posthog)) {
    clearEventQueues(posthog)
    resetIdentity(posthog)
    registerDeviceProperties(posthog)
  }
  if (uid !== null) posthog.identify(uid)
}

/**
 * Screen name from Expo Router segments: route groups and `index` dropped,
 * dynamic segments kept as their pattern (`/sighting/[id]`), so names group
 * by screen and never carry record ids.
 */
export function screenNameFromSegments(segments: readonly string[]): string {
  const visible = segments.filter(
    (segment) => !segment.startsWith('(') && segment !== 'index',
  )
  return `/${visible.join('/')}`
}
