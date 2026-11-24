import { http, HttpResponse } from 'msw'
import { PostHog } from 'posthog-react-native'
import { server } from '@/src/test-utils/mswServer'
import {
  posthogFlagClient,
  registerFlagClient,
} from '@/src/shared/analytics/featureFlags'

/** The host every flag test points the SDK at. */
export const FLAGS_HOST = 'https://flags.example.com'

/** The flags endpoint's reply for these values, in the SDK's v2 shape. */
export function flagsReply(values: Record<string, boolean>) {
  return {
    flags: Object.fromEntries(
      Object.entries(values).map(([key, enabled]) => [
        key,
        { key, enabled, reason: {}, metadata: {} },
      ]),
    ),
    errorsWhileComputingFlags: false,
  }
}

const clients: PostHog[] = []

/**
 * Mounts the real PostHog SDK the way AnalyticsBridge does after consent:
 * registered as the flag client, its flags endpoint answered by MSW with
 * `values` unless the test adds its own handler. Lifecycle capture is off;
 * it is analytics, not flags.
 */
export function mountFlagSdk(values?: Record<string, boolean>): PostHog {
  server.use(
    http.get(`${FLAGS_HOST}/array/*`, () => HttpResponse.json({})),
    ...(values
      ? [
          http.post(`${FLAGS_HOST}/flags/`, () =>
            HttpResponse.json(flagsReply(values)),
          ),
        ]
      : []),
  )
  const posthog = new PostHog('public-project-token', {
    host: FLAGS_HOST,
    persistence: 'memory',
    preloadFeatureFlags: false,
    captureAppLifecycleEvents: false,
    flushAt: 1,
  })
  clients.push(posthog)
  registerFlagClient(posthogFlagClient(posthog))
  return posthog
}

/** Unregisters and shuts down every SDK mountFlagSdk started. */
export async function unmountFlagSdks(): Promise<void> {
  registerFlagClient(null)
  await Promise.all(clients.splice(0).map((c) => c.shutdown()))
}
