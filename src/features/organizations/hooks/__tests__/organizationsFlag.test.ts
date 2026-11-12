import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { http, HttpResponse } from 'msw'
import { server } from '@/src/test-utils/mswServer'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'

let nextId = 0
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
beforeEach(() => {
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
