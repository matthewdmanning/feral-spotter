import { userEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import CreateSubmissionScreen from '@/src/features/draft-submission/screens/create/index'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { submissionCopy } from '@/src/shared/config/text'

/**
 * Model of the location-warning icon's gate on Submission Details
 * (src/features/draft-submission/screens/create/index.tsx) — tappable and pushes to the
 * map picker only while `showLocationWarning` (no fix, or accuracy at/above
 * LOCATION_ACCURACY_THRESHOLD_M); otherwise disabled and shows the acquired
 * state. This is a real toggle no other test exercises — the map picker
 * screen itself is separately modeled in LocationPicker.model.test.tsx.
 */

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/src/shared/lib/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

jest.mock('@/src/features/draft-submission/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
  }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
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

  const mount = async () => {
    useSubmissionStore.setState({ cats: [observedCat()] })
    await render(<CreateSubmissionScreen />)
  }

  const testParams = {
    states: {
      unmounted: () => {
        expect(router.push).not.toHaveBeenCalled()
      },
      noFix: () => {
        const icon = screen.getByLabelText(
          submissionCopy.location.accuracyUncertainAccessibility,
        )
        expect(icon.props.accessibilityState?.disabled).not.toBe(true)
      },
      acquired: () => {
        const icon = screen.getByLabelText(
          submissionCopy.location.acquiredAccessibility,
        )
        expect(icon.props.accessibilityState?.disabled).toBe(true)
      },
    },
    events: {
      MOUNT_NO_FIX: async () => {
        await mount()
      },
      MOUNT_LOW_ACCURACY: async () => {
        useSubmissionStore.setState((state) => ({
          submission: {
            ...state.submission,
            latitude: 34.68,
            longitude: -82.83,
            accuracy: 200,
          },
        }))
        await mount()
      },
      MOUNT_GOOD_FIX: async () => {
        useSubmissionStore.setState((state) => ({
          submission: {
            ...state.submission,
            latitude: 34.68,
            longitude: -82.83,
            accuracy: 10,
          },
        }))
        await mount()
      },
    },
  }
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
  ]

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })

  it('tapping the icon while warning is shown opens the map picker', async () => {
    await mount()
    await userEvent.press(
      screen.getByLabelText(
        submissionCopy.location.accuracyUncertainAccessibility,
      ),
    )
    expect(router.push).toHaveBeenCalledWith('/submission/location-picker')
  })

  it('tapping the icon once a good fix is acquired does nothing (disabled)', async () => {
    useSubmissionStore.setState((state) => ({
      submission: {
        ...state.submission,
        latitude: 34.68,
        longitude: -82.83,
        accuracy: 10,
      },
    }))
    await mount()
    await userEvent.press(
      screen.getByLabelText(submissionCopy.location.acquiredAccessibility),
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('reopens the map picker for a previously selected manual location', async () => {
    useSubmissionStore.setState((state) => ({
      submission: {
        ...state.submission,
        location_type: 'pin',
        latitude: 10,
        longitude: 20,
        accuracy: null,
      },
    }))
    await mount()

    await userEvent.press(
      screen.getByLabelText(submissionCopy.location.manualAccessibility),
    )

    expect(router.push).toHaveBeenCalledWith('/submission/location-picker')
  })
})
