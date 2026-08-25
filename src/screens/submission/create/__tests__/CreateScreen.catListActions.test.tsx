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
 * Finished!'s `disabled={cats.length === 0}` used to be unreachable — the
 * component returned null above it whenever cats.length === 0 (the #173
 * auto-skip gate). #299 made it reachable: removing the last cat now renders
 * an empty state rather than redirecting, so zero-cats is a state the user
 * can actually sit in, with Submit disabled there (#265).
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

let mockParams: { removed?: string } = {}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
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
  Trash2: () => null,
}))

const DEFAULT_CATS = [
  { local_id: 'cat-1', age: 'adult', pattern: 'tabby', hair_length: 'short' },
  { local_id: 'cat-2', age: 'kitten', pattern: 'solid', hair_length: 'long' },
]

let mockCats = [...DEFAULT_CATS]

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
    mockParams = {}
    mockCats = [...DEFAULT_CATS]
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

/**
 * #299. Zero cats means two different situations that must not behave alike:
 *
 * - Landed here with nothing recorded — a first pass. The user has to see the
 *   photos to pick a cat out of them, so auto-skip into annotate is right.
 * - Removed the last cat — they may want another look at the photos, or may
 *   want to describe a cat they saw but cannot pick out of one. Forcing
 *   annotate here takes that choice away, and forcing it *silently* (the
 *   pre-#299 behavior, where the screen rendered null) looks like a crash.
 *
 * The failure worth catching is the second collapsing back into the first.
 */
describe('Cat List with no cats left (#299)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCats = []
  })

  // The in-place case: still mounted, trash the last row. Distinct from the
  // two below, which mount already-empty — here the mount-time snapshot was
  // taken while cats existed. Pre-#299 this rendered null, so the user's own
  // delete blanked the screen out from under them.
  it('renders the choice, not a blank screen, when the last row is trashed in place', async () => {
    mockParams = {}
    mockCats = [...DEFAULT_CATS]
    const { rerender } = render(<CreateSubmissionScreen />)
    await waitFor(() => expect(screen.getByText('Cats Recorded')).toBeTruthy())

    mockCats = []
    rerender(<CreateSubmissionScreen />)

    expect(screen.getByText('Annotate Photos')).toBeTruthy()
    expect(screen.getByText('Describe a Cat')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('offers annotate or describe after the last cat is removed, and does not redirect', async () => {
    // `removed` is what the Cat Form's remove sets when it lands back here.
    mockParams = { removed: '1' }
    render(<CreateSubmissionScreen />)

    await waitFor(() =>
      expect(screen.getByText('Annotate Photos')).toBeTruthy(),
    )
    expect(screen.getByText('Describe a Cat')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('routes each choice to its own destination', async () => {
    mockParams = { removed: '1' }
    render(<CreateSubmissionScreen />)
    await waitFor(() =>
      expect(screen.getByText('Annotate Photos')).toBeTruthy(),
    )

    fireEvent.press(screen.getByText('Describe a Cat'))
    expect(router.push).toHaveBeenCalledWith('/submission/cats')

    fireEvent.press(screen.getByText('Annotate Photos'))
    expect(router.push).toHaveBeenCalledWith('/submission/annotate')
  })

  it('still auto-skips when the user simply arrived with nothing recorded', async () => {
    mockParams = {}
    render(<CreateSubmissionScreen />)

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/submission/annotate'),
    )
    expect(screen.queryByText('Describe a Cat')).toBeNull()
  })
})
