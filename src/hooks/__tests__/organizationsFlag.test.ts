import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useOrganizationsFlag } from '../useOrganizationsFlag'

jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: jest.fn(),
}))
let mockNextId = 0
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        posthogProjectToken: 'public-project-token',
        posthogHost: 'https://flags.example.com',
      },
    },
  },
}))
const originalFetch = global.fetch
const fetchMock = jest.fn()
beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `mutation-${++mockNextId}` as ReturnType<typeof randomUUID>,
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

test('unknown, off and failed evaluation results never enable the feature', async () => {
  for (const result of [
    {},
    { flags: { Organizations: { enabled: false } } },
    {
      flags: { Organizations: { enabled: true } },
      errorsWhileComputingFlags: true,
    },
  ]) {
    fetchMock.mockResolvedValue({ ok: true, json: async () => result })
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState().enabled).toBe(false)
  }
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

test('malformed successful responses disable a previously cached enabled flag', async () => {
  for (const response of [
    { ok: true, json: async () => null },
    {
      ok: true,
      json: async () => {
        throw new Error('invalid JSON')
      },
    },
  ]) {
    await AsyncStorage.setItem(
      'organizations-flag-v1',
      JSON.stringify({ enabled: true, checkedAt: Date.now() }),
    )
    fetchMock.mockResolvedValue(response)
    await useOrganizationsFlag.getState().refresh()
    expect(useOrganizationsFlag.getState().enabled).toBe(false)
  }
})
