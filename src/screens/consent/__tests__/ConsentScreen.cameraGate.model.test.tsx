import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, Platform } from 'react-native'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import ConsentScreen from '../index'
import consentCopy from '@/src/content/consentDisclosure.json'

const mockRequestCameraPermission = jest.fn()
let mockCameraPermissionStatus: string
jest.mock('react-native-vision-camera', () => ({
  get VisionCamera() {
    return {
      requestCameraPermission: mockRequestCameraPermission,
      get cameraPermissionStatus() {
        return mockCameraPermissionStatus
      },
    }
  },
}))

// Location held granted+fine throughout — out of scope here, mirrors the
// old model holding location GRANTED.
const grantedLocation = { granted: true, android: { accuracy: 'fine' } }
const mockRequestForegroundPermissionsAsync = jest.fn()
const mockGetForegroundPermissionsAsync = jest.fn()
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
}))

const mockRouterReplace = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    push: jest.fn(),
  },
}))

jest.mock('@/src/hooks/useConsentStore', () => ({
  useConsentStore: (sel: (s: object) => unknown) =>
    sel({ markAccepted: jest.fn() }),
}))

jest.mock('@/src/hooks/useBackHandler', () => ({
  useBackHandler: jest.fn(),
}))

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: {
      background: '#fff',
      text: '#000',
      muted: '#888',
      border: '#ccc',
      accent: '#00f',
      accentText: '#fff',
      surfaceAlt: '#eee',
      danger: '#f00',
    },
    spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
    typography: { sm: 12, base: 16, xl: 20, xxl: 24 },
    radius: { sm: 4, md: 8, lg: 12 },
  }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

/**
 * Model of ConsentScreen's camera-permission gate (src/screens/consent/index.tsx),
 * mirroring ConsentScreen.locationGate.model.test.tsx but for camera's status
 * — location is held granted+fine throughout, out of scope here. There's no
 * camera equivalent of the location model's LIMITED journey — vision-camera
 * has no partial-access concept for camera.
 *
 * Guards #237: the gate used to check `cameraStatus === RESULTS.BLOCKED`
 * only, unlike location's gate (which already covered DENIED and UNAVAILABLE
 * after #66/#233). A first-time camera "Don't allow" reports 'not-determined'
 * under react-native-vision-camera, not 'denied' — same asymmetry #66 fixed
 * for location, just never applied to camera. Both permissions gate via
 * `isCameraGated`/`isLocationGated` now (#243 — migrated off
 * react-native-permissions).
 */
const cameraGateMachine = createMachine({
  id: 'consentCameraGate',
  initial: 'idle',
  states: {
    idle: {
      on: {
        AGREE_GRANTED: 'granted',
        AGREE_DENIED: 'gated',
        AGREE_BLOCKED: 'gated',
        AGREE_UNAVAILABLE: 'gated',
      },
    },
    granted: {},
    gated: {
      on: {
        FOREGROUND_STILL_DENIED: 'gated',
        FOREGROUND_GRANTED: 'granted',
      },
    },
  },
})

describe('ConsentScreen camera gate — model-based test', () => {
  let foregroundListener: ((state: string) => void) | undefined
  let cameraResult: string

  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    cameraResult = 'authorized'
    mockCameraPermissionStatus = 'authorized'
    foregroundListener = undefined

    mockRequestCameraPermission.mockImplementation(async () => {
      mockCameraPermissionStatus = cameraResult
      return cameraResult === 'authorized'
    })
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        foregroundListener = listener as (state: string) => void
        return { remove: jest.fn() }
      })

    render(<ConsentScreen />)
  })

  const model = createTestModel(cameraGateMachine)

  const pressAgree = async () => {
    await act(async () => {
      fireEvent.press(screen.getByLabelText(consentCopy.agreeLabel))
    })
  }

  const triggerForeground = async () => {
    await act(async () => {
      foregroundListener?.('active')
    })
  }

  const testParams = {
    states: {
      idle: () => {
        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(screen.queryByText('Permission Blocked')).toBeNull()
      },
      granted: async () => {
        await waitFor(() =>
          expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
        )
      },
      gated: async () => {
        await waitFor(() =>
          expect(screen.getByText('Permission Blocked')).toBeTruthy(),
        )
      },
    },
    events: {
      AGREE_GRANTED: async () => {
        cameraResult = 'authorized'
        await pressAgree()
      },
      AGREE_DENIED: async () => {
        cameraResult = 'not-determined'
        await pressAgree()
      },
      AGREE_BLOCKED: async () => {
        cameraResult = 'denied'
        await pressAgree()
      },
      AGREE_UNAVAILABLE: async () => {
        cameraResult = 'restricted'
        await pressAgree()
      },
      FOREGROUND_STILL_DENIED: async () => {
        mockCameraPermissionStatus = 'not-determined'
        await triggerForeground()
      },
      FOREGROUND_GRANTED: async () => {
        mockCameraPermissionStatus = 'authorized'
        await triggerForeground()
      },
    },
  }

  // UX journeys, not exhaustive coverage: each is a sequence of real user
  // actions, asserting what the user sees at every step.
  const journeys = [
    {
      name: 'full camera grant proceeds straight to sign-in',
      events: [{ type: 'AGREE_GRANTED' }],
    },
    {
      name: 'camera BLOCKED stays gated (regression guard — already correct)',
      events: [{ type: 'AGREE_BLOCKED' }],
    },
    {
      name: 'first-time camera Don’t allow is gated, not passed through (#237 fix)',
      events: [{ type: 'AGREE_DENIED' }],
    },
    {
      name: 'camera Don’t allow, backgrounded without visiting Settings, stays gated',
      events: [{ type: 'AGREE_DENIED' }, { type: 'FOREGROUND_STILL_DENIED' }],
    },
    {
      name: 'camera Don’t allow, then granted in Settings, gate clears to sign-in',
      events: [{ type: 'AGREE_DENIED' }, { type: 'FOREGROUND_GRANTED' }],
    },
    {
      name: 'camera UNAVAILABLE stays gated',
      events: [{ type: 'AGREE_UNAVAILABLE' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
