import { render, waitFor, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import type { PhotoSource } from '@/src/hooks/usePhotoStore'
import CreateSubmissionScreen from '../index'

/**
 * Model of the bottom "add more photos" action (#156): label and press
 * behavior are driven entirely by `usePhotoStore().source` (ADR 0002
 * amendment's single-source-by-construction field) — no new state needed.
 * Mirrors HomeScreen.photoSourceGate.model.test.tsx's mocking pattern for
 * the same reasons (persisted-store rehydration crashes react-test-renderer
 * in this setup).
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

const mockPickFromLibrary = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
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

jest.mock('@/src/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: mockPickFromLibrary }),
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
}))

let mockSource: PhotoSource = 'camera'

jest.mock('@/src/hooks/usePhotoStore', () => ({
  usePhotoStore: (sel: (s: { source: PhotoSource }) => unknown) =>
    sel({ source: mockSource }),
}))

type Cat = {
  local_id: string
  age: string
  pattern: string
  hair_length: string
}

jest.mock('@/src/hooks/useSubmissionStore', () => ({
  useSubmissionStore: (
    sel: (s: {
      submission: { location_type: string; time_type: string }
      cats: Cat[]
      setSubmissionLocation: jest.Mock
      setManualTime: jest.Mock
      setCurrentStep: jest.Mock
    }) => unknown,
  ) =>
    sel({
      submission: { location_type: 'device', time_type: 'device' },
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
  let getByText: ReturnType<typeof render>['getByText']

  beforeEach(() => {
    jest.clearAllMocks()
    mockSource = 'camera'
    const result = render(<CreateSubmissionScreen />)
    getByText = result.getByText
    rerender = result.rerender
  })

  const model = createTestModel(sourceMachine)

  const testParams = {
    states: {
      camera: async () => {
        await waitFor(() => expect(getByText('Take More Photos')).toBeTruthy())
        fireEvent.press(getByText('Take More Photos'))
        expect(router.navigate).toHaveBeenCalledWith('/camera')
      },
      library: async () => {
        await waitFor(() =>
          expect(getByText('Select More Photos')).toBeTruthy(),
        )
        fireEvent.press(getByText('Select More Photos'))
        expect(mockPickFromLibrary).toHaveBeenCalledTimes(1)
      },
    },
    events: {
      SWITCH_TO_LIBRARY: () => {
        mockSource = 'library'
        rerender(<CreateSubmissionScreen />)
      },
      SWITCH_TO_CAMERA: () => {
        mockSource = 'camera'
        rerender(<CreateSubmissionScreen />)
      },
    },
  }

  const journeys = [
    {
      name: 'camera-sourced draft shows Take More Photos and reopens the camera',
      events: [] as const,
    },
    {
      name: 'library-sourced draft shows Select More Photos and reopens the library picker',
      events: [{ type: 'SWITCH_TO_LIBRARY' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
