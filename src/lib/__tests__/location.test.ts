import {
  startLocationCapture,
  getLocationCaptureState,
  __resetLocationCaptureForTests,
} from '@/src/lib/location'
import { useConsentStore } from '@/src/hooks/useConsentStore'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

const mockGetForegroundPermissionsAsync = jest.fn()
const mockWatchPositionAsync = jest.fn()
const removeMock = jest.fn()

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3 },
}))

describe('startLocationCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    __resetLocationCaptureForTests()
    useConsentStore.setState({ accepted: false, acceptedVersion: null })
    mockWatchPositionAsync.mockResolvedValue({ remove: removeMock })
  })

  afterEach(() => {
    // Clears any real setTimeout left running by the "pending" test above.
    __resetLocationCaptureForTests()
  })

  it('never touches expo-location when consent has not been accepted', async () => {
    await startLocationCapture()

    expect(getLocationCaptureState().status).toBe('idle')
    expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled()
    expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  })

  it("stays idle when permission isn't granted", async () => {
    useConsentStore.getState().markAccepted()
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' })

    await startLocationCapture()

    expect(getLocationCaptureState().status).toBe('idle')
    expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  })

  it('resolves to a stubbed fix in dev without watching for a real one', async () => {
    useConsentStore.getState().markAccepted()
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })

    await startLocationCapture()

    const state = getLocationCaptureState()
    expect(state.status).toBe('resolved')
    expect(state.result).toMatchObject({
      latitude: 34.6834,
      longitude: -82.8374,
    })
    expect(mockWatchPositionAsync).not.toHaveBeenCalled()
  })

  it('is a no-op while a fetch is already in flight (cannot restart while ongoing)', async () => {
    useConsentStore.getState().markAccepted()
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })
    // Never resolves on its own — stays "pending" until we drive it manually.
    let watchCallback: ((fix: unknown) => void) | undefined
    mockWatchPositionAsync.mockImplementation((_opts, cb) => {
      watchCallback = cb
      return new Promise(() => {})
    })
    const originalDev = global.__DEV__
    global.__DEV__ = false

    try {
      void startLocationCapture()
      await Promise.resolve()
      await Promise.resolve()
      expect(getLocationCaptureState().status).toBe('pending')
      const startedAt = getLocationCaptureState().startedAt

      await startLocationCapture()

      // Second call didn't restart the watch or reset the clock.
      expect(mockGetForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
      expect(getLocationCaptureState().startedAt).toBe(startedAt)
      expect(watchCallback).toBeDefined()
    } finally {
      global.__DEV__ = originalDev
    }
  })
})
