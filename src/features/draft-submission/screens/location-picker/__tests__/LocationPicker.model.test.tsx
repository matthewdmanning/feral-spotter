import {
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import {
  useSubmissionStore,
  type SubmissionDraft,
} from '@/src/features/draft-submission/hooks/useSubmissionStore'
import LocationPickerScreen from '@/src/features/draft-submission/screens/location-picker/index'

/**
 * Model of the map picker's program flow
 * (src/screens/submission/location-picker/index.tsx), scoped only to this flow.
 * Per ADR 0002 the Submission location is the map centre when the user
 * confirms: "Set location" commits the dragged-to point, Cancel returns
 * without changing it. The native map SDK is mocked — an external API is
 * exactly what a flow test should stub.
 */

const MOVED = { latitude: 10, longitude: 20 }
const INITIAL_SUBMISSION: SubmissionDraft = {
  location_type: 'device',
  time_type: 'manual',
  manual_time: '2026-10-21T12:30:00.000Z',
  latitude: 34.68,
  longitude: -82.83,
  accuracy: 120,
}

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}))

// Mock the native map: a pressable that fires onCameraMove with a fixed centre.
jest.mock('expo-maps', () => {
  const ReactLocal = jest.requireActual('react')
  const { Pressable } = jest.requireActual('react-native')
  return {
    GoogleMaps: {
      View: ({ onCameraMove }: { onCameraMove?: (e: unknown) => void }) =>
        ReactLocal.createElement(Pressable, {
          testID: 'camera-move',
          onPress: () =>
            onCameraMove?.({ coordinates: { latitude: 10, longitude: 20 } }),
        }),
    },
  }
})

jest.mock('expo-location', () => ({
  ...jest.requireActual('expo-location'),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
}))

const pickerFlow = createMachine({
  id: 'locationPicker',
  initial: 'ready',
  states: {
    ready: {
      on: {
        MOVE: 'moved',
        CANCEL: 'cancelled',
      },
    },
    moved: { on: { SET: 'confirmed', CANCEL: 'cancelled' } },
    confirmed: {},
    cancelled: {},
  },
})

describe('Location picker — flow (model-based)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSubmissionStore.setState({
      submission: { ...INITIAL_SUBMISSION },
    })
    render(<LocationPickerScreen />)
  })

  const model = createTestModel(pickerFlow)

  const testParams = {
    states: {
      ready: () => {
        expect(router.back).not.toHaveBeenCalled()
        expect(screen.getByText('Set location')).toBeTruthy()
        expect(useSubmissionStore.getState().submission).toEqual(
          INITIAL_SUBMISSION,
        )
      },
      moved: () => {
        expect(router.back).not.toHaveBeenCalled()
        expect(useSubmissionStore.getState().submission).toEqual(
          INITIAL_SUBMISSION,
        )
      },
      confirmed: async () => {
        await waitFor(() =>
          expect(useSubmissionStore.getState().submission).toEqual({
            ...INITIAL_SUBMISSION,
            ...MOVED,
            location_type: 'pin',
            accuracy: null,
          }),
        )
        expect(router.back).toHaveBeenCalledTimes(1)
      },
      cancelled: () => {
        expect(router.back).toHaveBeenCalledTimes(1)
        expect(useSubmissionStore.getState().submission).toEqual(
          INITIAL_SUBMISSION,
        )
      },
    },
    events: {
      MOVE: async () => {
        await userEvent.press(screen.getByTestId('camera-move'))
      },
      SET: async () => {
        await userEvent.press(screen.getByText('Set location'))
      },
      CANCEL: async () => {
        await userEvent.press(screen.getByText('Cancel'))
      },
    },
  }

  const journeys = [
    {
      name: 'moving then setting commits a manual pin and preserves Submission time',
      events: [{ type: 'MOVE' }, { type: 'SET' }],
    },
    {
      name: 'moving then cancelling preserves the original Submission draft',
      events: [{ type: 'MOVE' }, { type: 'CANCEL' }],
    },
    {
      name: 'cancelling without moving preserves the original Submission draft',
      events: [{ type: 'CANCEL' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
