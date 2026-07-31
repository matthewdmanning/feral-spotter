import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import LocationPickerScreen from '../index'

/**
 * Model of the map picker's program flow
 * (src/screens/submission/location-picker/index.tsx), scoped only to this flow.
 * Per ADR 0002 the Submission location is the map centre when the user
 * confirms: "Set location" commits the dragged-to point, Cancel returns
 * without changing it. The native map SDK is mocked — an external API is
 * exactly what a flow test should stub.
 */

const MOVED = { latitude: 10, longitude: 20 }

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
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}))

// Mock the native map: a pressable that fires onCameraMove with a fixed centre.
jest.mock('expo-maps', () => {
  const ReactLocal = require('react')
  const { Pressable } = require('react-native')
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
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
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

jest.mock('lucide-react-native', () => ({ MapPin: () => null }))

const pickerFlow = createMachine({
  id: 'locationPicker',
  initial: 'ready',
  states: {
    ready: {
      on: {
        MOVE_AND_SET: 'confirmed',
        CANCEL: 'cancelled',
      },
    },
    confirmed: {},
    cancelled: {},
  },
})

describe('Location picker — flow (model-based)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSubmissionStore.setState({
      submission: { location_type: 'pin', time_type: 'device' },
    })
    render(<LocationPickerScreen />)
  })

  const model = createTestModel(pickerFlow)

  const testParams = {
    states: {
      ready: () => {
        expect(router.back).not.toHaveBeenCalled()
        expect(
          useSubmissionStore.getState().submission.latitude,
        ).toBeUndefined()
      },
      confirmed: async () => {
        await waitFor(() =>
          expect(useSubmissionStore.getState().submission.latitude).toBe(
            MOVED.latitude,
          ),
        )
        expect(useSubmissionStore.getState().submission.longitude).toBe(
          MOVED.longitude,
        )
        expect(router.back).toHaveBeenCalled()
      },
      cancelled: () => {
        expect(router.back).toHaveBeenCalled()
        // Cancel must not write a location.
        expect(
          useSubmissionStore.getState().submission.latitude,
        ).toBeUndefined()
      },
    },
    events: {
      MOVE_AND_SET: () => {
        fireEvent.press(screen.getByTestId('camera-move'))
        fireEvent.press(screen.getByText('Set location'))
      },
      CANCEL: () => {
        fireEvent.press(screen.getByText('Cancel'))
      },
    },
  }

  model.getShortestPaths().forEach((path) => {
    it(path.description, async () => {
      await path.test(testParams)
    })
  })
})
