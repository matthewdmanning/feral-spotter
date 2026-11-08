import { act, render, waitFor, userEvent } from '@testing-library/react-native'
import React from 'react'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'
import CreateSubmissionScreen from '@/src/features/draft-submission/screens/create/index'

/**
 * Model of the bottom "add more photos" action (#156): label and press
 * behavior are driven entirely by `usePhotoStore().source` (ADR 0002
 * amendment's single-source-by-construction field) — no new state needed.
 * Real draft stores keep the screen and workflow subscriptions in sync.
 */

const mockPickFromLibrary = jest.fn()

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

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

jest.mock('@/src/features/library-picker/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: mockPickFromLibrary }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

// Draft sync has its own tests (useDraftSync.*.test.ts); this suite covers the screen's wiring.
jest.mock('@/src/features/draft-submission/hooks/useDraftSync', () => ({
  useDraftSync: () => undefined,
}))

const sourceMachine = createMachine({
  id: 'addMorePhotosAction',
  initial: 'camera',
  states: {
    camera: { on: { SWITCH_TO_LIBRARY: 'library' } },
    library: { on: { SWITCH_TO_CAMERA: 'camera' } },
  },
})

describe('Submission Details add-more-photos action — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void
  let getByText: Awaited<ReturnType<typeof render>>['getByText']

  beforeEach(async () => {
    usePhotoStore.setState({ source: 'camera', photos: [submissionPhoto()] })
    useSubmissionStore.setState({ cats: [observedCat()] })
    const result = await render(<CreateSubmissionScreen />)
    getByText = result.getByText
    rerender = result.rerender
  })

  const model = createTestModel(sourceMachine)

  const testParams = {
    states: {
      camera: async () => {
        await waitFor(() => expect(getByText('Take More Photos')).toBeTruthy())
        await userEvent.press(getByText('Take More Photos'))
        expect(router.navigate).toHaveBeenCalledWith('/camera')
      },
      library: async () => {
        await waitFor(() =>
          expect(getByText('Select More Photos')).toBeTruthy(),
        )
        await userEvent.press(getByText('Select More Photos'))
        expect(mockPickFromLibrary).toHaveBeenCalledTimes(1)
      },
    },
    events: {
      SWITCH_TO_LIBRARY: async () => {
        await act(() => usePhotoStore.setState({ source: 'library' }))
        await rerender(<CreateSubmissionScreen />)
      },
      SWITCH_TO_CAMERA: async () => {
        await act(() => usePhotoStore.setState({ source: 'camera' }))
        await rerender(<CreateSubmissionScreen />)
      },
    },
  }

  const journeys = [
    {
      name: 'camera-sourced draft shows Take More Photos and reopens the camera',
      events: [],
    },
    {
      name: 'library-sourced draft shows Select More Photos and reopens the library picker',
      events: [{ type: 'SWITCH_TO_LIBRARY' }],
    },
  ]

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
