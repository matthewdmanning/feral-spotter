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

// Camera held authorized throughout — out of scope here, mirrors the old
// model holding camera GRANTED.
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

const mockMarkAccepted = jest.fn()
jest.mock('@/src/hooks/useConsentStore', () => ({
  useConsentStore: (sel: (s: object) => unknown) =>
    sel({ markAccepted: mockMarkAccepted }),
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
 * Model of ConsentScreen's location-permission gate (src/screens/consent/index.tsx),
 * scoped to `expo-location`'s `LocationPermissionResponse` shape (#243 —
 * migrated off react-native-permissions). Camera is held authorized
 * throughout: that permission's gating has its own mirrored model,
 * ConsentScreen.cameraGate.model.test.tsx (#237), out of scope here.
 *
 * Guards against #66: a first-time full "Don't allow" resolves
 * `granted: false`, not a terminal denial (react-native-permissions called
 * this DENIED vs BLOCKED). The old gate checked BLOCKED only, so a
 * first-time denial bypassed it entirely and proceeded like a full grant.
 * `gated` here covers both the escalated-denial case and location's
 * Approximate-accuracy case (`granted: true, android.accuracy: 'coarse'`),
 * which already gated correctly before this fix — that path must keep
 * working unchanged.
 *
 * Every outcome `expo-location` can report on Android is wired into this
 * machine: a bare denial and Approximate (coarse-only) grant both gate, same
 * as before — there's no expo-location equivalent of the old UNAVAILABLE
 * status, and no dedicated journey for it since it would just re-test the
 * same assertions a plain denial already covers. The iOS reduced-accuracy
 * journeys (`ios.accuracy: 'reduced'`, the old LIMITED concept) switch
 * `Platform.OS` to `'ios'` for that event only, since reduced access is a
 * genuinely iOS-only outcome under the new, platform-aware gate — it does
 * not gate, same as a full grant.
 *
 * Also guards the relaunch-bypass reopen of #66: `markAccepted()` must not
 * fire while gated. It used to fire unconditionally before the gate check,
 * so a gated user who force-quit and relaunched was already "consented" and
 * skipped straight past this screen on the next launch, with location still
 * denied and nothing downstream re-checking it. Every `gated` assertion
 * below confirms `markAccepted` was *not* called; every `granted` assertion
 * confirms it *was*.
 */
const locationGateMachine = createMachine({
  id: 'consentLocationGate',
  initial: 'idle',
  states: {
    idle: {
      on: {
        AGREE_GRANTED: 'granted',
        AGREE_DENIED: 'gated',
        AGREE_BLOCKED: 'gated',
        AGREE_UNAVAILABLE: 'gated',
        AGREE_LIMITED: 'granted',
      },
    },
    granted: {},
    gated: {
      on: {
        FOREGROUND_STILL_DENIED: 'gated',
        FOREGROUND_STILL_BLOCKED: 'gated',
        FOREGROUND_STILL_UNAVAILABLE: 'gated',
        FOREGROUND_GRANTED: 'granted',
        FOREGROUND_LIMITED: 'granted',
      },
    },
  },
})

const grantedLocation = { granted: true, android: { accuracy: 'fine' } }
const deniedLocation = { granted: false, android: { accuracy: 'none' } }
const approximateLocation = { granted: true, android: { accuracy: 'coarse' } }
const reducedIosLocation = { granted: true, ios: { accuracy: 'reduced' } }

describe('ConsentScreen location gate — model-based test', () => {
  let foregroundListener: ((state: string) => void) | undefined
  let locationResult: object

  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    locationResult = grantedLocation
    mockCameraPermissionStatus = 'authorized'
    foregroundListener = undefined

    mockRequestCameraPermission.mockResolvedValue(true)
    mockRequestForegroundPermissionsAsync.mockImplementation(
      async () => locationResult,
    )
    mockGetForegroundPermissionsAsync.mockImplementation(
      async () => locationResult,
    )
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        foregroundListener = listener as (state: string) => void
        return { remove: jest.fn() }
      })

    render(<ConsentScreen />)
  })

  const model = createTestModel(locationGateMachine)

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
        expect(mockMarkAccepted).not.toHaveBeenCalled()
      },
      granted: async () => {
        await waitFor(() =>
          expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
        )
        expect(mockMarkAccepted).toHaveBeenCalled()
      },
      gated: async () => {
        await waitFor(() =>
          expect(screen.getByText('Permission Blocked')).toBeTruthy(),
        )
        expect(mockMarkAccepted).not.toHaveBeenCalled()
      },
    },
    events: {
      AGREE_GRANTED: async () => {
        locationResult = grantedLocation
        await pressAgree()
      },
      AGREE_DENIED: async () => {
        locationResult = deniedLocation
        await pressAgree()
      },
      AGREE_BLOCKED: async () => {
        locationResult = approximateLocation
        await pressAgree()
      },
      AGREE_UNAVAILABLE: async () => {
        // No expo-location equivalent of UNAVAILABLE — reuses the denied
        // response, which lands on the same `gated` state either way.
        locationResult = deniedLocation
        await pressAgree()
      },
      AGREE_LIMITED: async () => {
        // Reduced accuracy is an iOS-only outcome under the new gate.
        Platform.OS = 'ios'
        locationResult = reducedIosLocation
        await pressAgree()
      },
      FOREGROUND_STILL_DENIED: async () => {
        locationResult = deniedLocation
        await triggerForeground()
      },
      FOREGROUND_STILL_BLOCKED: async () => {
        locationResult = approximateLocation
        await triggerForeground()
      },
      FOREGROUND_STILL_UNAVAILABLE: async () => {
        locationResult = deniedLocation
        await triggerForeground()
      },
      FOREGROUND_GRANTED: async () => {
        locationResult = grantedLocation
        await triggerForeground()
      },
      FOREGROUND_LIMITED: async () => {
        Platform.OS = 'ios'
        locationResult = reducedIosLocation
        await triggerForeground()
      },
    },
  }

  // UX journeys, not exhaustive coverage: each is a sequence of real user
  // actions, asserting what the user sees at every step.
  const journeys = [
    {
      name: 'full precise grant proceeds straight to sign-in',
      events: [{ type: 'AGREE_GRANTED' }],
    },
    {
      name: 'Approximate accuracy stays gated (regression guard — already correct)',
      events: [{ type: 'AGREE_BLOCKED' }],
    },
    {
      name: 'first-time Don’t allow is gated, not passed through (#66 fix)',
      events: [{ type: 'AGREE_DENIED' }],
    },
    {
      name: 'Don’t allow, backgrounded without visiting Settings, stays gated',
      events: [{ type: 'AGREE_DENIED' }, { type: 'FOREGROUND_STILL_DENIED' }],
    },
    {
      name: 'Don’t allow, then granted in Settings, gate clears to sign-in',
      events: [{ type: 'AGREE_DENIED' }, { type: 'FOREGROUND_GRANTED' }],
    },
    {
      name: 'LIMITED proceeds ungated, same as a full grant',
      events: [{ type: 'AGREE_LIMITED' }],
    },
    {
      name: 'Don’t allow, then Settings reports LIMITED, gate clears to sign-in',
      events: [{ type: 'AGREE_DENIED' }, { type: 'FOREGROUND_LIMITED' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
