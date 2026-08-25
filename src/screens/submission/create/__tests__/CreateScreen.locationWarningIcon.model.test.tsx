import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import CreateSubmissionScreen from '../index'

/**
 * Model of the location-warning icon's gate on Submission Details
 * (src/screens/submission/create/index.tsx) — tappable and pushes to the
 * map picker only while `showLocationWarning` (no fix, or accuracy at/above
 * LOCATION_ACCURACY_THRESHOLD_M); otherwise disabled and shows the acquired
 * state. This is a real toggle no other test exercises — the map picker
 * screen itself is separately modeled in LocationPicker.model.test.tsx.
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

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

jest.mock('@/src/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
  }),
}))

jest.mock('@/src/lib/location', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: () => anyProp() })
  const theme = new Proxy({}, { get: () => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  CheckCircle: () => null,
  Trash2: () => null,
}))

interface MockSubmission {
  location_type: string
  time_type: string
  latitude?: number
  longitude?: number
  accuracy?: number | null
}

let mockSubmission: MockSubmission

jest.mock('@/src/hooks/useSubmissionStore', () => ({
  useSubmissionStore: (
    sel: (s: {
      submission: MockSubmission
      cats: {
        local_id: string
        age: string
        pattern: string
        hair_length: string
      }[]
      setSubmissionLocation: jest.Mock
      setManualTime: jest.Mock
      setCurrentStep: jest.Mock
    }) => unknown,
  ) =>
    sel({
      submission: mockSubmission,
      cats: [
        {
          local_id: 'cat-1',
          age: 'adult',
          pattern: 'tabby',
          hair_length: 'short',
        },
      ],
      setSubmissionLocation: jest.fn(),
      setManualTime: jest.fn(),
      setCurrentStep: jest.fn(),
    }),
}))

const gateMachine = createMachine({
  id: 'locationWarningIcon',
  initial: 'unmounted',
  states: {
    unmounted: {
      on: {
        MOUNT_NO_FIX: 'noFix',
        MOUNT_LOW_ACCURACY: 'noFix',
        MOUNT_GOOD_FIX: 'acquired',
      },
    },
    noFix: {},
    acquired: {},
  },
})

describe('Submission Details location-warning icon — model-based test', () => {
  const model = createTestModel(gateMachine)

  const mount = () => render(<CreateSubmissionScreen />)

  const testParams = {
    states: {
      unmounted: () => {
        expect(router.push).not.toHaveBeenCalled()
      },
      noFix: () => {
        const icon = screen.getByLabelText(
          'Location accuracy is low or unavailable — tap to set manually',
        )
        expect(icon.props.accessibilityState?.disabled).not.toBe(true)
      },
      acquired: () => {
        const icon = screen.getByLabelText('Location acquired')
        expect(icon.props.accessibilityState?.disabled).toBe(true)
      },
    },
    events: {
      MOUNT_NO_FIX: () => {
        mockSubmission = { location_type: 'device', time_type: 'device' }
        mount()
      },
      MOUNT_LOW_ACCURACY: () => {
        mockSubmission = {
          location_type: 'device',
          time_type: 'device',
          latitude: 34.68,
          longitude: -82.83,
          accuracy: 200,
        }
        mount()
      },
      MOUNT_GOOD_FIX: () => {
        mockSubmission = {
          location_type: 'device',
          time_type: 'device',
          latitude: 34.68,
          longitude: -82.83,
          accuracy: 10,
        }
        mount()
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const journeys = [
    {
      name: 'no fix yet: warning shown, icon tappable',
      events: [{ type: 'MOUNT_NO_FIX' }],
    },
    {
      name: 'accuracy below threshold: still warns',
      events: [{ type: 'MOUNT_LOW_ACCURACY' }],
    },
    {
      name: 'good fix acquired: warning clears, icon disabled',
      events: [{ type: 'MOUNT_GOOD_FIX' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })

  it('tapping the icon while warning is shown opens the map picker', () => {
    mockSubmission = { location_type: 'device', time_type: 'device' }
    mount()
    fireEvent.press(
      screen.getByLabelText(
        'Location accuracy is low or unavailable — tap to set manually',
      ),
    )
    expect(router.push).toHaveBeenCalledWith('/submission/location-picker')
  })

  it('tapping the icon once a good fix is acquired does nothing (disabled)', () => {
    mockSubmission = {
      location_type: 'device',
      time_type: 'device',
      latitude: 34.68,
      longitude: -82.83,
      accuracy: 10,
    }
    mount()
    fireEvent.press(screen.getByLabelText('Location acquired'))
    expect(router.push).not.toHaveBeenCalled()
  })
})
