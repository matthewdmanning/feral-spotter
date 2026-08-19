import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import {
  startLocationCapture,
  getLocationCaptureState,
  __resetLocationCaptureForTests,
} from '@/src/lib/location'
import { CONSENT_VERSION, useConsentStore } from '@/src/hooks/useConsentStore'
import { LOCATION_STALE_THRESHOLD_MS } from '@/src/config/location'

/**
 * Model of the background Live-fix singleton's reacquire flow
 * (src/lib/location.ts, per docs/adr/0002-location-services-model.md's
 * 2026-07-31 amendment): it starts once, cannot be restarted while watching,
 * and — once it settles, good fix or not — automatically retries after the
 * stale window without needing another caller to notice.
 */

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

let watchCallback: ((fix: unknown) => void) | undefined
const removeMock = jest.fn()
const mockGetForegroundPermissionsAsync = jest.fn()
const mockWatchPositionAsync = jest.fn()

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3, High: 4 },
}))

function fix(accuracy: number) {
  return {
    coords: { latitude: 1, longitude: 2, accuracy },
    timestamp: 1700000000000,
  }
}

const reacquireFlow = createMachine({
  id: 'locationReacquire',
  initial: 'idle',
  states: {
    idle: {
      on: { START: 'watching' },
    },
    watching: {
      on: {
        GOOD_FIX: 'resolvedGood',
        STALE_TIMEOUT: 'resolvedSettled',
        // Cannot be restarted while ongoing — a second START is a no-op.
        REDUNDANT_START: 'watching',
      },
    },
    resolvedGood: {
      on: { RECHECK_TIMEOUT: 'reacquiring' },
    },
    resolvedSettled: {
      on: { RECHECK_TIMEOUT: 'reacquiring' },
    },
    reacquiring: {
      on: { GOOD_FIX: 'resolvedGoodAfterReacquire' },
    },
    resolvedGoodAfterReacquire: {},
  },
})

describe('Location capture — reacquire flow (model-based)', () => {
  let originalDev: boolean

  beforeEach(() => {
    // The dev-stub short-circuit in src/lib/location.ts bypasses watching
    // entirely — this flow is only exercised with __DEV__ off, same as prod.
    originalDev = global.__DEV__
    global.__DEV__ = false
    jest.useFakeTimers()
    jest.clearAllMocks()
    __resetLocationCaptureForTests()
    watchCallback = undefined
    useConsentStore.setState({
      accepted: true,
      acceptedVersion: CONSENT_VERSION,
    })
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })
    mockWatchPositionAsync.mockImplementation((_opts, cb) => {
      watchCallback = cb
      return Promise.resolve({ remove: removeMock })
    })
  })

  afterEach(() => {
    __resetLocationCaptureForTests()
    jest.useRealTimers()
    global.__DEV__ = originalDev
  })

  const model = createTestModel(reacquireFlow)

  const testParams = {
    states: {
      idle: () => {
        expect(getLocationCaptureState().status).toBe('idle')
      },
      watching: () => {
        expect(getLocationCaptureState().status).toBe('pending')
      },
      resolvedGood: () => {
        expect(getLocationCaptureState().status).toBe('resolved')
        expect(getLocationCaptureState().result?.accuracy).toBeLessThan(50)
      },
      resolvedSettled: () => {
        expect(getLocationCaptureState().status).toBe('resolved')
      },
      reacquiring: () => {
        expect(getLocationCaptureState().status).toBe('pending')
      },
      resolvedGoodAfterReacquire: () => {
        expect(getLocationCaptureState().status).toBe('resolved')
        expect(getLocationCaptureState().result?.accuracy).toBeLessThan(50)
      },
    },
    events: {
      START: async () => {
        void startLocationCapture()
        await jest.advanceTimersByTimeAsync(0)
      },
      REDUNDANT_START: async () => {
        const startedAt = getLocationCaptureState().startedAt
        await startLocationCapture()
        // No restart: the clock (and the permission check) didn't run again.
        expect(getLocationCaptureState().startedAt).toBe(startedAt)
        expect(mockGetForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
      },
      GOOD_FIX: async () => {
        watchCallback?.(fix(10))
        await jest.advanceTimersByTimeAsync(0)
      },
      STALE_TIMEOUT: async () => {
        await jest.advanceTimersByTimeAsync(LOCATION_STALE_THRESHOLD_MS)
      },
      RECHECK_TIMEOUT: async () => {
        // The automatic retry fires on its own timer — no caller re-triggers it.
        await jest.advanceTimersByTimeAsync(LOCATION_STALE_THRESHOLD_MS)
      },
    },
  }

  model
    .getPathsFromEvents([{ type: 'START' }, { type: 'GOOD_FIX' }])
    .forEach((path) => {
      it(path.description, async () => {
        await path.test(testParams)
      })
    })

  model
    .getPathsFromEvents([
      { type: 'START' },
      { type: 'REDUNDANT_START' },
      { type: 'GOOD_FIX' },
    ])
    .forEach((path) => {
      it(path.description, async () => {
        await path.test(testParams)
      })
    })

  model
    .getPathsFromEvents([
      { type: 'START' },
      { type: 'STALE_TIMEOUT' },
      { type: 'RECHECK_TIMEOUT' },
      { type: 'GOOD_FIX' },
    ])
    .forEach((path) => {
      it(path.description, async () => {
        await path.test(testParams)
      })
    })
})
