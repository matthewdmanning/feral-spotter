import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
const originalFetch = global.fetch
const fetchMock = jest.fn()
/** A fresh, enabled evaluation, so each case must actively turn it off. */
async function startEnabled() {
  useOrganizationsFlag.setState({ enabled: true })
  await AsyncStorage.setItem(
    'organizations-flag-v1',
    JSON.stringify({ enabled: true, checkedAt: Date.now() }),
  )
}
beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `installation-${++nextId}` as ReturnType<typeof randomUUID>,
    )
  global.fetch = fetchMock
  fetchMock.mockReset()
  useOrganizationsFlag.setState({ enabled: false })
})
afterAll(() => {
  global.fetch = originalFetch
})

test('evaluates Organizations without analytics, identity or location; a fresh cached result works offline', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ flags: { Organizations: { enabled: true } } }),
  })
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe('https://flags.example.com/flags/?v=2')
  expect(JSON.parse(options.body)).toEqual({
    token: 'public-project-token',
    distinct_id: expect.any(String),
    geoip_disable: true,
  })
  const installation = JSON.parse(options.body).distinct_id
  fetchMock.mockRejectedValue(new Error('offline'))
  useOrganizationsFlag.setState({ enabled: false })
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(true)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).distinct_id).toBe(
    installation,
  )
  await AsyncStorage.setItem(
    'organizations-flag-v1',
    JSON.stringify({
      enabled: true,
      checkedAt: Date.now() - 25 * 60 * 60 * 1000,
    }),
  )
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(false)
})

test.each<[string, () => Promise<unknown>]>([
  ['an unknown flag', async () => ({})],
  [
    'an off flag',
    async () => ({ flags: { Organizations: { enabled: false } } }),
  ],
  [
    'an evaluation error',
    async () => ({
      flags: { Organizations: { enabled: true } },
      errorsWhileComputingFlags: true,
    }),
  ],
  ['a null body', async () => null],
  [
    'invalid JSON',
    async () => {
      throw new Error('invalid JSON')
    },
  ],
])('%s turns off a previously enabled flag', async (_name, json) => {
  await startEnabled()
  fetchMock.mockResolvedValue({ ok: true, json })
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(false)
})

test('corrupt cached evaluation does not prevent an online refresh', async () => {
  await AsyncStorage.setItem('organizations-flag-v1', '{broken')
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ flags: { Organizations: { enabled: true } } }),
  })
  await useOrganizationsFlag.getState().refresh()
  expect(useOrganizationsFlag.getState().enabled).toBe(true)
})
