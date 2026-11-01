import {
  __resetLocationCaptureForTests,
  startLocationCapture,
  stopLocationCapture,
} from '@/src/lib/location'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'

/**
 * A GPS watch nobody removes drains the battery for the rest of the
 * process. Two starts racing across the permission check, or a Reset that
 * lands while a start is still awaiting the OS, each used to leave one.
 */

const mockWatchPositionAsync = jest.fn()
let mockResolvePermission: (value: unknown) => void = () => {}

jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-location', () => ({
  ...jest.requireActual('expo-location'),
  hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
  getForegroundPermissionsAsync: () =>
    new Promise((resolve) => {
      mockResolvePermission = resolve
    }),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
}))

const granted = { granted: true, android: { accuracy: 'fine' } }
const flush = () => new Promise((resolve) => setImmediate(resolve))

let live = 0
beforeEach(() => {
  jest.clearAllMocks()
  __resetLocationCaptureForTests()
  useConsentStore.getState().markAccepted()
  live = 0
  mockWatchPositionAsync.mockImplementation(async () => {
    live += 1
    return { remove: () => (live -= 1) }
  })
})
afterEach(() => __resetLocationCaptureForTests())

it('starts one watch when two starts overlap the permission check', async () => {
  const first = startLocationCapture()
  const second = startLocationCapture()
  mockResolvePermission(granted)
  await Promise.all([first, second])
  await flush()
  expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1)
  stopLocationCapture()
  expect(live).toBe(0)
})

it('starts no watch when stopped while the permission check is pending', async () => {
  const start = startLocationCapture()
  stopLocationCapture()
  mockResolvePermission(granted)
  await start
  await flush()
  expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  expect(live).toBe(0)
})
