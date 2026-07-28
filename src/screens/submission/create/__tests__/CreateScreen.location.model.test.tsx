import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { captureCurrentLocation } from '@/src/lib/location'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import CreateSubmissionScreen from '../index'

/**
 * Model of the Create screen's Submission-location program flow
 * (src/screens/submission/create/index.tsx), scoped only to this flow — not a
 * project-wide pattern. Per ADR 0002 the one Submission location is acquired
 * once on Continue: a `device` method takes a single Live fix, a failed fix or
 * a `pin` method routes to the map picker, and a good fix proceeds to cats.
 * Model-based testing walks every branch via @xstate/graph instead of only the
 * cases someone thought to hand-write.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({ getString: jest.fn(), set: jest.fn(), delete: jest.fn() })),
}))

jest.mock('@/src/lib/location', () => ({ captureCurrentLocation: jest.fn() }))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
  updateSubmissionCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: () => anyProp() })
  const theme = new Proxy({}, { get: () => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

// Bypass the real Unistyles stylesheet (its `theme.x * n` arithmetic can't run
// against the proxy theme); styling is irrelevant to the flow under test.
jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('lucide-react-native', () => ({ Info: () => null }))

jest.mock('@/src/components/organisms/DateTimePicker', () => ({
  DateTimePickerButton: () => null,
}))

const DEFAULT_SUBMISSION = { location_type: 'device' as const, time_type: 'device' as const }

const locationFlow = createMachine({
  id: 'createLocation',
  initial: 'editing',
  states: {
    editing: {
      on: {
        CONTINUE_DEVICE_FIX_OK: 'continuedToCats',
        CONTINUE_DEVICE_FIX_FAIL: 'routedToPicker',
        SELECT_PIN_AND_CONTINUE: 'routedToPicker',
      },
    },
    continuedToCats: {},
    routedToPicker: {},
  },
})

describe('Create screen — Submission-location flow (model-based)', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.clear()
    useSubmissionStore.setState({
      cats: [],
      submission: { ...DEFAULT_SUBMISSION },
      history: [],
      currentStep: 'create',
    })
    render(<CreateSubmissionScreen />)
  })

  const pressContinue = async () => {
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'))
    })
  }

  const model = createTestModel(locationFlow)

  const testParams = {
    states: {
      editing: () => {
        expect(router.push).not.toHaveBeenCalled()
      },
      continuedToCats: async () => {
        await waitFor(() =>
          expect(router.push).toHaveBeenCalledWith('/submission/cats'),
        )
      },
      routedToPicker: async () => {
        await waitFor(() =>
          expect(router.push).toHaveBeenCalledWith('/submission/location-picker'),
        )
        expect(router.push).not.toHaveBeenCalledWith('/submission/cats')
      },
    },
    events: {
      CONTINUE_DEVICE_FIX_OK: async () => {
        ;(captureCurrentLocation as jest.Mock).mockResolvedValueOnce({
          latitude: 1,
          longitude: 2,
          accuracy: 5,
          timestamp: '2026-07-28T00:00:00.000Z',
        })
        await pressContinue()
      },
      CONTINUE_DEVICE_FIX_FAIL: async () => {
        ;(captureCurrentLocation as jest.Mock).mockResolvedValueOnce(undefined)
        await pressContinue()
      },
      SELECT_PIN_AND_CONTINUE: async () => {
        fireEvent.press(screen.getByText('Pin Drop'))
        await pressContinue()
      },
    },
  }

  model.getShortestPaths().forEach((path) => {
    it(path.description, async () => {
      await path.test(testParams)
    })
  })
})
