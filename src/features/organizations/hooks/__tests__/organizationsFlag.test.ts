import { http, HttpResponse } from 'msw'
import { server } from '@/src/test-utils/mswServer'
import {
  FLAGS_HOST as HOST,
  flagsReply,
  mountFlagSdk,
  unmountFlagSdks,
} from '@/src/test-utils/posthogFlags'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'

/**
 * The Organizations rollout through the real PostHog SDK, answered by MSW at
 * its flags endpoint. The SDK exists only once AppProviders mounts it after
 * consent; here a test registers it the same way AnalyticsBridge does.
 */

const flags = FEATURE_FLAGS as { organizations: boolean }
const buildFlag = flags.organizations

let rollout: Record<string, boolean>
let offline: boolean
let flagRequests: number
let captureRequests: number

function grantConsent(analytics: boolean | null) {
  useConsentStore.getState().bindChoicesTo('account')
  useConsentStore.setState({
    accepted: true,
    acceptedVersion: CONSENT_VERSION,
    analyticsAccepted: analytics,
  })
}

beforeEach(() => {
  // Full consent and the build flag off: the PostHog rollout decides.
  flags.organizations = false
  grantConsent(true)
  rollout = { Organizations: true, PinInteractions: true }
  offline = false
  flagRequests = 0
  captureRequests = 0
  server.use(
    http.post(`${HOST}/flags/`, () => {
      flagRequests += 1
      if (offline) return HttpResponse.error()
      return HttpResponse.json(flagsReply(rollout))
    }),
    http.post(`${HOST}/batch/`, () => {
      captureRequests += 1
      return HttpResponse.json({})
    }),
  )
})
afterEach(async () => {
  flags.organizations = buildFlag
  await unmountFlagSdks()
})

const ON = { Organizations: true, PinInteractions: true }
const OFF = { Organizations: false, PinInteractions: false }
test.each([
  // build flag, consent, SDK mounted, rollout → enabled, PostHog asked
  // Without consent the build flag decides and PostHog is never asked.
  ['off', 'none', ON, false, false],
  ['off', 'data only', ON, false, false],
  ['on', 'none', OFF, true, false],
  ['on', 'data only', OFF, true, false],
  // With analytics consent PostHog wins, either way.
  ['off', 'analytics', ON, true, true],
  ['on', 'analytics', OFF, false, true],
  ['on', 'analytics', ON, true, true],
  ['off', 'analytics', OFF, false, true],
] as const)(
  'build flag %s, consent %s: rollout %j gives enabled=%s, asked PostHog=%s',
  async (build, consent, values, enabled, asked) => {
    flags.organizations = build === 'on'
    // A client left registered must not count once consent is withdrawn.
    mountFlagSdk()
    if (consent === 'none') useConsentStore.setState({ accepted: false })
    else grantConsent(consent === 'analytics')
    rollout = values
    useOrganizationsFlag.setState({
      enabled: !enabled,
      pinInteractionsEnabled: !enabled,
    })
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState().enabled).toBe(enabled)
    expect(flagRequests > 0).toBe(asked)
  },
)

test('no SDK mounted: the build flag decides', async () => {
  flags.organizations = true
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: false,
  })
  expect(flagRequests).toBe(0)
})

test('concurrent refreshes share one evaluation and send no event; a known rollout holds offline', async () => {
  const posthog = mountFlagSdk()
  const first = useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().refresh()).toBe(first)
  await first
  expect(flagRequests).toBe(1)
  await posthog.flush()
  expect(captureRequests).toBe(0)
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: true,
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
})

test('an off parent turns pin interactions off too', async () => {
  mountFlagSdk()
  rollout = { Organizations: false, PinInteractions: true }
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: false,
    pinInteractionsEnabled: false,
  })
})

test.each([
  ['missing', { Organizations: true }],
  ['off', { Organizations: true, PinInteractions: false }],
])(
  'an independently %s PinInteractions flag keeps shared Sightings available',
  async (_name, values) => {
    mountFlagSdk()
    rollout = values
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState()).toMatchObject({
      enabled: true,
      pinInteractionsEnabled: false,
    })
  },
)

test('no evaluation for Organizations falls back to the build flag, not to off', async () => {
  flags.organizations = true
  mountFlagSdk()
  rollout = {}
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: false,
  })
})

test('offline with no stored evaluation: the build flag decides', async () => {
  flags.organizations = true
  mountFlagSdk()
  offline = true
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState()).toMatchObject({
    enabled: true,
    pinInteractionsEnabled: false,
  })
})
