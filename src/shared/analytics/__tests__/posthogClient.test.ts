import { waitFor } from '@testing-library/react-native'
import { http, HttpResponse } from 'msw'
import type { PostHog } from 'posthog-react-native'
import { server } from '@/src/test-utils/mswServer'
import {
  POSTHOG_OPTIONS,
  closePostHogClient,
  forgetSignedOutIdentity,
  openPostHogClient,
  resetPostHogClient,
  screenNameFromSegments,
  syncPostHogIdentity,
} from '@/src/shared/analytics/posthogClient'

/**
 * The app's PostHog client through the real SDK (memory persistence); its
 * startup requests are answered by MSW. Catches: a revoked client that
 * keeps sending, a retry that carries one account's batch past another's
 * gate, a re-consent that builds a second client, and a sign-in that links
 * one user's person to another's. Remote flags are off: identity changes
 * would otherwise start flag requests that outlive the test.
 */

const HOST = 'https://posthog.example.com'

type Message = { event?: string; properties?: Record<string, unknown> }

function open(allowsRequest?: (posthog: PostHog) => boolean): PostHog {
  return openPostHogClient(
    'public-project-token',
    HOST,
    {
      ...POSTHOG_OPTIONS,
      persistence: 'memory',
      disableRemoteFeatureFlags: true,
      preloadFeatureFlags: false,
      captureAppLifecycleEvents: false,
      errorTracking: { autocapture: {} },
      // Nothing is sent: the tests read the SDK's own enqueue events.
      flushAt: 1000,
      flushInterval: 0,
    },
    allowsRequest,
  )
}

function record(posthog: PostHog, type: 'capture' | 'identify'): Message[] {
  const seen: Message[] = []
  posthog.on(type, (message: Message | string) => {
    if (typeof message !== 'string') seen.push(message)
  })
  return seen
}

beforeEach(() => {
  server.use(http.all(`${HOST}/*`, () => HttpResponse.json({})))
})

afterEach(resetPostHogClient)

describe('PostHog client lifetime', () => {
  it('stops capturing after revocation and resumes on the same client', async () => {
    const posthog = open()
    await posthog.ready()
    const captured = record(posthog, 'capture')

    closePostHogClient()
    posthog.capture('after_revoke')
    expect(captured).toHaveLength(0)

    expect(open()).toBe(posthog)
    posthog.capture('after_regrant')
    expect(captured.map((m) => m.event)).toEqual(['after_regrant'])
  })
})

it('drops queued events and blocks SDK requests after revocation', async () => {
  const requests = jest.fn()
  server.use(
    http.all(`${HOST}/*`, () => {
      requests()
      return HttpResponse.json({})
    }),
  )
  let hasConsent = true
  const posthog = open(() => hasConsent)
  await posthog.ready()
  requests.mockClear()
  posthog.capture('queued_before_revoke')

  hasConsent = false
  closePostHogClient()
  await posthog.flush()
  const response = await posthog.fetch(`${HOST}/flags`, {
    method: 'POST',
    headers: {},
  })

  expect(response.status).toBe(403)
  expect(requests).not.toHaveBeenCalled()
  hasConsent = true
  open()
  await posthog.flush()
  expect(requests).not.toHaveBeenCalled()
})

it('a retry of one account’s batch is not sent after switching accounts', async () => {
  const batches: string[] = []
  let failNext = true
  server.use(
    http.post(`${HOST}/batch/`, async ({ request }) => {
      batches.push(await request.text())
      if (failNext) {
        failNext = false
        return new HttpResponse(null, { status: 500 })
      }
      return HttpResponse.json({})
    }),
  )
  let allowedUid = 'user-a'
  const allows = (sdk: PostHog) => sdk.getDistinctId() === allowedUid
  const posthog = openPostHogClient(
    'public-project-token',
    HOST,
    {
      ...POSTHOG_OPTIONS,
      persistence: 'memory',
      preloadFeatureFlags: false,
      disableRemoteFeatureFlags: true,
      captureAppLifecycleEvents: false,
      errorTracking: { autocapture: {} },
      disableCompression: true,
      flushAt: 1000,
      flushInterval: 0,
      fetchRetryCount: 2,
      fetchRetryDelay: 50,
    },
    allows,
  )
  await posthog.ready()
  syncPostHogIdentity(posthog, 'user-a')
  posthog.capture('a_private_event')
  const flushing = posthog.flush().catch(() => undefined)
  await waitFor(() => expect(batches).toHaveLength(1))

  // Sign-out, then B signs in and opts in before A's retry is due.
  closePostHogClient()
  allowedUid = 'user-b'
  openPostHogClient('public-project-token', HOST, undefined, allows)
  syncPostHogIdentity(posthog, 'user-b')
  await flushing

  expect(batches).toHaveLength(1)
  expect(batches.join()).not.toContain('user-b')
})

it('sign-out leaves no account identity in SDK storage and stays off', async () => {
  const posthog = open()
  await posthog.ready()
  syncPostHogIdentity(posthog, 'user-a')

  forgetSignedOutIdentity()
  await posthog.ready()
  await Promise.resolve()

  expect(posthog.getDistinctId()).not.toBe('user-a')
  expect(posthog.optedOut).toBe(true)
})

describe('syncPostHogIdentity', () => {
  it('does not link a new user to the previous one', async () => {
    const posthog = open()
    await posthog.ready()
    // Linked to user A's person by A's sign-in.
    const linkedToA = posthog.getDistinctId()
    syncPostHogIdentity(posthog, 'user-a')
    const identifies = record(posthog, 'identify')

    syncPostHogIdentity(posthog, 'user-b')

    expect(posthog.getDistinctId()).toBe('user-b')
    expect(identifies).toHaveLength(1)
    const anon = identifies[0].properties?.$anon_distinct_id
    expect([linkedToA, 'user-a']).not.toContain(anon)
  })

  it('merges the anonymous identity on first sign-in', async () => {
    const posthog = open()
    await posthog.ready()
    const anonymous = posthog.getDistinctId()
    const identifies = record(posthog, 'identify')

    syncPostHogIdentity(posthog, 'user-a')
    syncPostHogIdentity(posthog, 'user-a')

    expect(identifies).toHaveLength(1)
    expect(identifies[0].properties?.$anon_distinct_id).toBe(anonymous)
  })

  it('returns to anonymous on sign-out and keeps device properties', async () => {
    const posthog = open()
    await posthog.ready()
    syncPostHogIdentity(posthog, 'user-a')
    const captured = record(posthog, 'capture')

    syncPostHogIdentity(posthog, null)
    posthog.capture('signed_out_event')

    expect(posthog.getDistinctId()).not.toBe('user-a')
    expect(captured[0].properties).toHaveProperty('is_physical_device')
  })
})

describe('screenNameFromSegments', () => {
  it.each([
    [['(home-tabs)'], '/'],
    [['(home-tabs)', 'feral-reports'], '/feral-reports'],
    [['sighting', '[id]'], '/sighting/[id]'],
    [['organizations', '[id]', 'members'], '/organizations/[id]/members'],
    [['submission', 'index'], '/submission'],
  ])('%p → %s', (segments, name) => {
    expect(screenNameFromSegments(segments)).toBe(name)
  })
})
