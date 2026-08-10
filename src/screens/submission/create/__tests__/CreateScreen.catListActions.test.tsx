import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import CreateSubmissionScreen from '../index'

/**
 * Button wiring on the Cat List section of Submission Details
 * (src/screens/submission/create/index.tsx) — mechanical onPress -> handler
 * checks, not a stateful flow, so plain cases rather than an xstate model
 * (matching AnnotateScreen.buttons.test.tsx's precedent for screen-level
 * wiring). CreateScreen.autoSkipGate.model.test.tsx and
 * CreateScreen.addMorePhotosAction.model.test.tsx already cover this
 * screen's real flows; nothing previously touched Add a Cat, a cat row's
 * edit navigation, or Finished!/Reset.
 *
 * Finished!'s `disabled={cats.length === 0}` is unreachable dead code —
 * the component returns null above that line whenever cats.length === 0
 * (the #173 auto-skip gate) — so that branch is not exercised here.
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
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

const mockHandleDone = jest.fn()
const mockHandleReset = jest.fn()
jest.mock('@/src/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: mockHandleDone,
    handleReset: mockHandleReset,
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
}))

const mockCats = [
  { local_id: 'cat-1', age: 'adult', pattern: 'tabby', hair_length: 'short' },
  { local_id: 'cat-2', age: 'kitten', pattern: 'solid', hair_length: 'long' },
]

jest.mock('@/src/hooks/useSubmissionStore', () => ({
  useSubmissionStore: (
    sel: (s: {
      submission: { location_type: string; time_type: string }
      cats: typeof mockCats
      setSubmissionLocation: jest.Mock
      setManualTime: jest.Mock
      setCurrentStep: jest.Mock
    }) => unknown,
  ) =>
    sel({
      submission: { location_type: 'device', time_type: 'device' },
      cats: mockCats,
      setSubmissionLocation: jest.fn(),
      setManualTime: jest.fn(),
      setCurrentStep: jest.fn(),
    }),
}))

describe('Cat List actions', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    render(<CreateSubmissionScreen />)
    // Let the mount-time auto-skip check settle before asserting — a
    // non-empty cats mock never redirects, but the effect still runs.
    await waitFor(() => expect(screen.getByText('Cats Recorded')).toBeTruthy())
  })

  it('Add a Cat navigates to annotate', () => {
    fireEvent.press(screen.getByText('Add a Cat'))
    expect(router.push).toHaveBeenCalledWith('/submission/annotate')
  })

  it('pressing a cat row opens Cat Form pre-filled for that cat, not another one', () => {
    fireEvent.press(screen.getByText('Adult · tabby · short hair'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/submission/cats',
      params: { edit: 'cat-1' },
    })

    fireEvent.press(screen.getByText('Kitten · solid · long hair'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/submission/cats',
      params: { edit: 'cat-2' },
    })
  })

  it('Finished! calls handleDone', () => {
    fireEvent.press(screen.getByText('Finished!'))
    expect(mockHandleDone).toHaveBeenCalledTimes(1)
  })

  it('Reset calls handleReset', () => {
    fireEvent.press(screen.getByText('Reset'))
    expect(mockHandleReset).toHaveBeenCalledTimes(1)
  })
})
