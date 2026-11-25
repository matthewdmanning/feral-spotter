import AsyncStorage from '@react-native-async-storage/async-storage'
import { http, HttpResponse } from 'msw'
import { server } from '@/src/test-utils/mswServer'
import { authProvider } from '@/src/features/auth/lib'
import {
  REQUEST_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  cancelConsentRetries,
  flushConsentRecords,
  syncAccountConsent,
} from '@/src/features/auth/lib/accountConsent'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import {
  CONSENT_VERSION,
  hasAcceptedAnalytics,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'

const URL = 'https://functions.example.com/consentRecords'

jest.mock('@/src/shared/config/constants', () => ({
  ...jest.requireActual('@/src/shared/config/constants'),
  CONSENT_RECORDS_URL: 'https://functions.example.com/consentRecords',
}))

/**
 * ADR-0009 on one device. Catches: a second account inheriting the first
 * one's analytics and email choices; a returning user asked again on a new
 * device; a cached grant surviving a revocation made elsewhere; a choice
 * lost, stuck or sent out of order when offline; an upgrade handing one
 * account's old choices to another.
 */

type Posted = Record<string, unknown>
let posted: Posted[]
let saved: Record<string, unknown>
let failPosts: number
let currentUid: string | null

function answerServer() {
  server.use(
    http.get(URL, ({ request }) => {
      if (request.headers.get('authorization') !== 'Bearer dev-stub-token')
        return new HttpResponse(null, { status: 401 })
      return HttpResponse.json(saved)
    }),
    http.post(URL, async ({ request }) => {
      if (failPosts > 0) {
        failPosts -= 1
        return new HttpResponse(null, { status: 503 })
      }
      posted.push((await request.json()) as Posted)
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

function acceptDisclosure() {
  useConsentStore.getState().markAccepted()
}

beforeEach(async () => {
  posted = []
  saved = {}
  failPosts = 0
  answerServer()
  // The records endpoint needs an ID token; the stub user supplies one.
  await authProvider.signInWithEmail('a@example.com', 'password')
  currentUid = 'user-a'
  jest
    .spyOn(authProvider, 'getCurrentUser')
    .mockImplementation(() =>
      currentUid === null ? null : { uid: currentUid, email: null },
    )
})

afterEach(async () => {
  cancelConsentRetries()
  jest.useRealTimers()
  await authProvider.signOut()
})

it('a second account on the device does not inherit the first one’s choices', async () => {
  acceptDisclosure()
  await syncAccountConsent('user-a')
  useConsentStore.getState().setAnalyticsAccepted(true)
  useConsentStore.getState().setEmailOptIn(true)

  currentUid = null
  await syncAccountConsent(null)
  currentUid = 'user-b'
  await syncAccountConsent('user-b')

  expect(hasAcceptedAnalytics()).toBe(false)
  expect(useConsentStore.getState().emailOptIn).toBeNull()
  expect(nextConsentRoute()).toBe('/analytics-consent')
})

it('a returning user on a new device gets their choices back unasked', async () => {
  saved = { analytics: { granted: true }, email_updates: { granted: false } }
  acceptDisclosure()

  await syncAccountConsent('user-a')

  expect(hasAcceptedAnalytics()).toBe(true)
  expect(useConsentStore.getState().emailOptIn).toBe(false)
  expect(nextConsentRoute()).toBe('/(home-tabs)')
  // Only the device's disclosure is new proof; restored choices are not resent.
  await flushConsentRecords('user-a')
  expect(posted.map((p) => p.kind)).toEqual(['data_collection'])
})

it('sends each choice once, in order, after an outage', async () => {
  acceptDisclosure()
  failPosts = 1
  await syncAccountConsent('user-a')
  useConsentStore.getState().setAnalyticsAccepted(false)
  await flushConsentRecords('user-a').catch(() => undefined)
  expect(posted).toEqual([])

  await flushConsentRecords('user-a')

  expect(posted).toEqual([
    expect.objectContaining({
      kind: 'data_collection',
      granted: true,
      version: CONSENT_VERSION,
      platform: expect.any(String),
      appVersion: expect.any(String),
    }),
    expect.objectContaining({ kind: 'analytics', granted: false }),
  ])
  expect(useConsentStore.getState().pendingRecords).toEqual([])
})

it('drops the queue for an erased account', async () => {
  server.use(http.post(URL, () => new HttpResponse(null, { status: 410 })))
  acceptDisclosure()
  await syncAccountConsent('user-a')

  await flushConsentRecords('user-a')

  expect(useConsentStore.getState().pendingRecords).toEqual([])
})

describe('an upgrade from choices with no known owner', () => {
  async function upgradeWithOldChoices() {
    // v0 kept these across sign-out: A may have made them, not the user now.
    await AsyncStorage.setItem(
      'consent-store',
      JSON.stringify({
        version: 0,
        state: {
          accepted: true,
          acceptedVersion: CONSENT_VERSION,
          analyticsAccepted: true,
          emailOptIn: true,
        },
      }),
    )
    await useConsentStore.persist.rehydrate()
  }

  it('keeps the disclosure and asks again when the server has nothing', async () => {
    await upgradeWithOldChoices()
    await syncAccountConsent('user-a')
    await flushConsentRecords('user-a')

    expect(useConsentStore.getState().accepted).toBe(true)
    expect(hasAcceptedAnalytics()).toBe(false)
    expect(nextConsentRoute()).toBe('/analytics-consent')
    expect(posted.map((p) => p.kind)).toEqual(['data_collection'])
  })

  it('restores the account’s own server choices', async () => {
    saved = { analytics: { granted: false }, email_updates: { granted: true } }
    await upgradeWithOldChoices()
    await syncAccountConsent('user-a')

    expect(hasAcceptedAnalytics()).toBe(false)
    expect(useConsentStore.getState().analyticsAccepted).toBe(false)
    expect(nextConsentRoute()).toBe('/(home-tabs)')
  })
})

it('a cached grant waits for the server and yields to a revocation made elsewhere', async () => {
  const get = jest.fn(() =>
    HttpResponse.json({ analytics: { granted: true }, revision: 1 }),
  )
  server.use(http.get(URL, get))
  acceptDisclosure()
  await syncAccountConsent('user-a')
  expect(hasAcceptedAnalytics()).toBe(true)

  // A later session on this device: the cache says yes, another device
  // revoked meanwhile.
  useConsentStore.setState({ verifiedUid: null })
  expect(hasAcceptedAnalytics()).toBe(false)
  get.mockImplementation(() =>
    HttpResponse.json({ analytics: { granted: false }, revision: 2 }),
  )
  await syncAccountConsent('user-a')

  expect(get).toHaveBeenCalledTimes(2)
  expect(useConsentStore.getState().analyticsAccepted).toBe(false)
  expect(hasAcceptedAnalytics()).toBe(false)
})

it('a choice carries the server revision this device had seen', async () => {
  saved = { analytics: { granted: false }, revision: 7 }
  acceptDisclosure()
  await syncAccountConsent('user-a')
  useConsentStore.getState().setAnalyticsAccepted(true)

  await flushConsentRecords('user-a')

  expect(posted.at(-1)).toEqual(
    expect.objectContaining({
      kind: 'analytics',
      granted: true,
      basedOnRevision: 7,
    }),
  )
})

/** Fake timers only after the network setup, which MSW runs on real ones. */
function useFakeClock() {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  })
}

describe('a stuck or failed send is retried on its own', () => {
  it('times out a stalled request, then retries', async () => {
    acceptDisclosure()
    await syncAccountConsent('user-a')
    await flushConsentRecords('user-a')
    posted.length = 0
    useConsentStore.getState().setAnalyticsAccepted(true)
    const token = jest
      .spyOn(authProvider, 'getToken')
      .mockImplementationOnce(() => new Promise<string>(() => undefined))
    useFakeClock()
    const stalled = flushConsentRecords('user-a')

    let settled = false
    void stalled.then(() => {
      settled = true
    })
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    expect(token).toHaveBeenCalledTimes(1)
    expect(posted).toEqual([])
    token.mockRestore()

    await jest.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    await jest.runOnlyPendingTimersAsync()
    expect(posted.map((p) => p.kind)).toEqual(['analytics'])
  })

  it('retries a transient server failure without another trigger', async () => {
    acceptDisclosure()
    await syncAccountConsent('user-a')
    await flushConsentRecords('user-a')
    posted.length = 0
    useConsentStore.getState().setAnalyticsAccepted(true)
    failPosts = 1
    useFakeClock()
    await flushConsentRecords('user-a')
    expect(posted).toEqual([])

    await jest.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    await jest.runOnlyPendingTimersAsync()

    expect(posted.map((p) => p.kind)).toEqual(['analytics'])
    expect(useConsentStore.getState().pendingRecords).toEqual([])
  })
})

it('does not post a queued choice after the account changes during token lookup', async () => {
  acceptDisclosure()
  await syncAccountConsent('user-a')
  await flushConsentRecords('user-a')
  posted.length = 0
  useConsentStore.getState().setAnalyticsAccepted(true)
  const token = jest
    .spyOn(authProvider, 'getToken')
    .mockImplementationOnce(async () => {
      currentUid = 'user-b'
      return 'different-account-token'
    })

  await flushConsentRecords('user-a')

  expect(posted).toEqual([])
  token.mockRestore()
})

it('shares a single restoration when both startup and navigation request consent', async () => {
  const get = jest.fn(() =>
    HttpResponse.json({
      analytics: { granted: true },
      email_updates: { granted: false },
    }),
  )
  server.use(http.get(URL, get))

  await Promise.all([
    syncAccountConsent('user-a'),
    syncAccountConsent('user-a'),
  ])

  expect(get).toHaveBeenCalledTimes(1)
  expect(nextConsentRoute()).toBe('/(home-tabs)')
})
