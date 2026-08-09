import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, Platform } from 'react-native'
import { check, request, RESULTS } from 'react-native-permissions'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import ConsentScreen from '../index'
import { PERMISSION_MAP } from '@/src/lib/permissions'
import consentCopy from '@/src/content/consentDisclosure.json'

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
 * Model of ConsentScreen's location-permission gate (src/screens/consent/index.tsx),
 * scoped to the status react-native-permissions actually reports for
 * `PERMISSION_MAP.location` — not the on-device grant dialog options. Camera
 * is held GRANTED throughout: that permission's gating is already covered by
 * ConsentScreen.test.tsx's blocked-permission recovery test and is out of
 * scope here (#66's older camera sub-thread is resolved).
 *
 * Guards against #66: a first-time full "Don't allow" reports DENIED, not
 * BLOCKED (Android only escalates to BLOCKED on a second denial). The old
 * gate checked BLOCKED only, so a first-time denial bypassed it entirely and
 * proceeded like a full grant. `blocked` here covers both the
 * escalated-denial case and location's Approximate-accuracy case, which
 * reads as BLOCKED on the very first request and already gated correctly
 * before this fix — that path must keep working unchanged.
 *
 * All 5 `RESULTS` values `react-native-permissions` can report are wired
 * into this machine, not just the 3 Android's location prompt realistically
 * returns: UNAVAILABLE (the feature/permission doesn't exist on this
 * device) gates, same as BLOCKED/DENIED — a Submission can't get a real
 * location without it. LIMITED (an iOS partial-access concept, not
 * applicable to Android's ACCESS_FINE_LOCATION) does not gate, same as
 * GRANTED. Only GRANTED/LIMITED/DENIED get dedicated journeys below —
 * BLOCKED and UNAVAILABLE both land on the same `gated` state DENIED
 * already exercises, so a standalone journey for either would just re-test
 * the same assertions.
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

describe('ConsentScreen location gate — model-based test', () => {
  let foregroundListener: ((state: string) => void) | undefined
  let locationResult: string

  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    locationResult = RESULTS.GRANTED
    foregroundListener = undefined

    jest
      .mocked(request)
      .mockImplementation(async (permission) =>
        permission === PERMISSION_MAP.location
          ? locationResult
          : RESULTS.GRANTED,
      )
    jest
      .mocked(check)
      .mockImplementation(async (permission) =>
        permission === PERMISSION_MAP.location
          ? locationResult
          : RESULTS.GRANTED,
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
        locationResult = RESULTS.GRANTED
        await pressAgree()
      },
      AGREE_DENIED: async () => {
        locationResult = RESULTS.DENIED
        await pressAgree()
      },
      AGREE_BLOCKED: async () => {
        locationResult = RESULTS.BLOCKED
        await pressAgree()
      },
      AGREE_UNAVAILABLE: async () => {
        locationResult = RESULTS.UNAVAILABLE
        await pressAgree()
      },
      AGREE_LIMITED: async () => {
        locationResult = RESULTS.LIMITED
        await pressAgree()
      },
      FOREGROUND_STILL_DENIED: async () => {
        locationResult = RESULTS.DENIED
        await triggerForeground()
      },
      FOREGROUND_STILL_BLOCKED: async () => {
        locationResult = RESULTS.BLOCKED
        await triggerForeground()
      },
      FOREGROUND_STILL_UNAVAILABLE: async () => {
        locationResult = RESULTS.UNAVAILABLE
        await triggerForeground()
      },
      FOREGROUND_GRANTED: async () => {
        locationResult = RESULTS.GRANTED
        await triggerForeground()
      },
      FOREGROUND_LIMITED: async () => {
        locationResult = RESULTS.LIMITED
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
