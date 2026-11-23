import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { http, HttpResponse } from 'msw'
import { server } from '@/src/test-utils/mswServer'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'

let nextId = 0
const flags = FEATURE_FLAGS as { organizations: boolean }
const buildFlag = flags.organizations
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants')
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      expoConfig: {
        ...actual.default.expoConfig,
        extra: {
          posthogProjectToken: 'public-project-token',
          posthogHost: 'https://flags.example.com',
        },
      },
    },
  }
})

const bothEnabled = {
  flags: {
    Organizations: { enabled: true },
    PinInteractions: { enabled: true },
  },
}
let evaluation: Record<string, unknown> | null
let offline: boolean
let invalidJSON: boolean
let requests: { url: string; body: unknown }[]

function grantConsent(analytics: boolean | null) {
  useConsentStore.setState({
    accepted: true,
    acceptedVersion: CONSENT_VERSION,
    analyticsAccepted: analytics,
  })
}

/** A fresh, enabled evaluation, so each case must actively turn it off. */
async function startEnabled() {
  useOrganizationsFlag.setState({ enabled: true, pinInteractionsEnabled: true })
  await AsyncStorage.setItem(
    'organizations-flag-v1',
    JSON.stringify({
      enabled: true,
      pinInteractionsEnabled: true,
      checkedAt: Date.now(),
    }),
  )
}
afterEach(() => {
  flags.organizations = buildFlag
})
beforeEach(() => {
  // Build flag off and full consent: the PostHog rollout decides.
  flags.organizations = false
  grantConsent(true)
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `installation-${++nextId}` as ReturnType<typeof randomUUID>,
    )
  evaluation = bothEnabled
  offline = false
  invalidJSON = false
  requests = []
  server.use(
    http.post('https://flags.example.com/flags/', async ({ request }) => {
      requests.push({ url: request.url, body: await request.json() })
      if (offline) return HttpResponse.error()
      if (invalidJSON)
        return new HttpResponse('{broken', {
          headers: { 'Content-Type': 'application/json' },
        })
      return HttpResponse.json(evaluation)
    }),
  )
})

const ROLLOUT_ON = bothEnabled
const ROLLOUT_OFF = {
  flags: {
    Organizations: { enabled: false },
    PinInteractions: { enabled: false },
  },
}
test.each([
  // build flag, consent, rollout → enabled, PostHog asked
  ['off', 'none', ROLLOUT_ON, false, false],
  ['off', 'data only', ROLLOUT_ON, false, false],
  ['on', 'none', ROLLOUT_OFF, true, false],
  ['on', 'data only', ROLLOUT_OFF, true, false],
  ['off', 'analytics', ROLLOUT_ON, true, true],
  ['off', 'analytics', ROLLOUT_OFF, false, true],
  ['on', 'analytics', ROLLOUT_OFF, true, true],
] as const)(
  'build flag %s, consent %s: rollout %j gives enabled=%s, asked PostHog=%s',
  async (build, consent, rollout, enabled, asked) => {
    flags.organizations = build === 'on'
    if (consent === 'none') useConsentStore.setState({ accepted: false })
    else grantConsent(consent === 'analytics' ? true : false)
    // A fresh cached rollout must not count without analytics consent.
    await startEnabled()
    evaluation = rollout
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState().enabled).toBe(enabled)
    expect(requests.length > 0).toBe(asked)
  },
)

test('the build flag never reaches the rollout cache', async () => {
  flags.organizations = true
  evaluation = ROLLOUT_OFF
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(true)
  // A later build without the flag reads the cache offline.
  flags.organizations = false
  offline = true
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(false)
})

test('the build flag on still takes PinInteractions from the rollout', async () => {
  flags.organizations = true
  evaluation = {
    flags: {
      Organizations: { enabled: false },
      PinInteractions: { enabled: true },
    },
  }
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: true,
  })
})

test('evaluates both flags once without analytics, account identity or location; fresh cached flags work offline', async () => {
  const first = useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().refresh()).toBe(first)
  await first
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: true,
  })
  expect(requests).toHaveLength(1)
  expect(requests[0]).toEqual({
    url: 'https://flags.example.com/flags/?v=2',
    body: {
      token: 'public-project-token',
      distinct_id: expect.any(String),
      geoip_disable: true,
    },
  })
  offline = true
  useOrganizationsFlag.setState({
    enabled: false,
    pinInteractionsEnabled: false,
  })
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: true,
  })
  expect(requests[1].body).toEqual(requests[0].body)
  await AsyncStorage.setItem(
    'organizations-flag-v1',
    JSON.stringify({
      enabled: true,
      pinInteractionsEnabled: true,
      checkedAt: Date.now() - 25 * 60 * 60 * 1000,
    }),
  )
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: false,
    pinInteractionsEnabled: false,
  })
})

test.each<[string, Record<string, unknown> | null]>([
  ['unknown flags', {}],
  [
    'off parent',
    {
      flags: {
        Organizations: { enabled: false },
        PinInteractions: { enabled: true },
      },
    },
  ],
  ['evaluation error', { ...bothEnabled, errorsWhileComputingFlags: true }],
  ['null body', null],
])('%s turns off previously enabled flags', async (_name, response) => {
  await startEnabled()
  evaluation = response
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: false,
    pinInteractionsEnabled: false,
  })
})

test.each([
  ['missing', {}],
  ['off', { PinInteractions: { enabled: false } }],
])(
  'an independently %s PinInteractions flag keeps shared Sightings available',
  async (_name, child) => {
    await startEnabled()
    evaluation = { flags: { Organizations: { enabled: true }, ...child } }
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState()).toMatchObject({
      enabled: true,
      pinInteractionsEnabled: false,
    })
    // A successful off evaluation replaces a previously cached on evaluation.
    offline = true
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState()).toMatchObject({
      enabled: true,
      pinInteractionsEnabled: false,
    })
  },
)

test('invalid JSON disables both flags instead of retaining an earlier on evaluation', async () => {
  await startEnabled()
  invalidJSON = true
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: false,
    pinInteractionsEnabled: false,
  })
})

test('a legacy cache never implicitly enables pin interactions', async () => {
  await AsyncStorage.setItem(
    'organizations-flag-v1',
    JSON.stringify({ enabled: true, checkedAt: Date.now() }),
  )
  offline = true
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: false,
  })
})

test('corrupt cached evaluation does not prevent an online refresh', async () => {
  await AsyncStorage.setItem('organizations-flag-v1', '{broken')
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: true,
  })
})
