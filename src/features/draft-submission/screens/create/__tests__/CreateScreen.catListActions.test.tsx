import {
  act,
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { router } from 'expo-router'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  useSubmissionStore,
  type ObservedCat,
} from '@/src/features/draft-submission/hooks/useSubmissionStore'
import { AlertHost } from '@/src/shared/ui/organisms/AlertHost'
import React from 'react'
import CreateSubmissionScreen from '../index'

/**
 * Button wiring on the Cat List section of Submission Details
 * (src/features/draft-submission/screens/create/index.tsx) — mechanical onPress -> handler
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

let mockParams: { removed?: string } = {}

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('@/src/features/draft-submission/lib/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

const mockHandleDone = jest.fn()
const mockHandleReset = jest.fn()
jest.mock('@/src/features/draft-submission/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: mockHandleDone,
    handleReset: mockHandleReset,
  }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

// cat-2 is deliberately sparse: every field it lacks must still be listed, as
// its default, when the cat is opened.
const DEFAULT_CATS: ObservedCat[] = [
  {
    local_id: 'cat-1',
    age: 'adult',
    ear_tipped: 'yes',
    owned_domesticated: 'no',
    pattern: 'tabby',
    hair_length: 'short',
    color: 'orange_tabby',
    sex: 'female',
    health_label: 'good',
    photo_local_ids: [],
    photos_reviewed: true,
  },
  // Legacy drafts can lack attributes added after the cat was saved.
  {
    local_id: 'cat-2',
    age: 'kitten',
    pattern: 'solid',
    hair_length: 'long',
  } as ObservedCat,
]

beforeEach(() => {
  useUIStore.setState({ dialog: null })
  useSubmissionStore.setState({
    submission: { location_type: 'device', time_type: 'device' },
    cats: [],
  })
})

describe('Cat List actions', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    mockParams = {}
    useSubmissionStore.setState({ cats: [...DEFAULT_CATS] })
    render(
      <>
        <CreateSubmissionScreen />
        <AlertHost />
      </>,
    )
    // Let the mount-time auto-skip check settle before asserting — a
    // non-empty list never redirects, but the effect still runs.
    await waitFor(() => expect(screen.getByText('Cats Recorded')).toBeTruthy())
  })

  it('Add a Cat navigates to annotate', async () => {
    await userEvent.press(screen.getByText('Add a Cat'))
    expect(router.push).toHaveBeenCalledWith('/submission/annotate')
  })

  // The Cats Recorded rows are an accordion: a press opens the cat's fields
  // in place and navigates nowhere; Edit Cat is the way into the form.
  it('pressing a cat row lists every field, including ones left at their default', async () => {
    await userEvent.press(screen.getByText('Kitten · solid · long hair'))

    expect(router.push).not.toHaveBeenCalled()
    for (const field of [
      'Age',
      'Sex',
      'Ear Tipped',
      'Hair Length',
      'Pattern',
      'Color',
      'Owned / Domesticated',
      'Health',
    ]) {
      expect(screen.getByText(field)).toBeTruthy()
    }
    // Sex, Ear Tipped, Owned, Color and Health are missing on this cat.
    expect(screen.getAllByText('Unknown')).toHaveLength(3)
    expect(screen.getAllByText('Unsure')).toHaveLength(2)
  })

  it('opens one cat at a time and closes it on a second press', async () => {
    await userEvent.press(screen.getByText('Adult · orange tabby · short hair'))
    expect(screen.getByText('Orange Tabby')).toBeTruthy()

    await userEvent.press(screen.getByText('Kitten · solid · long hair'))
    expect(screen.queryByText('Orange Tabby')).toBeNull()

    await userEvent.press(screen.getByText('Kitten · solid · long hair'))
    expect(screen.queryByText('Edit')).toBeNull()
  })

  it('offers Delete on an open cat and removes only that cat after confirmation', async () => {
    expect(screen.queryByText('Delete')).toBeNull()

    await userEvent.press(screen.getByText('Kitten · solid · long hair'))
    await userEvent.press(screen.getByText('Delete'))

    expect(useUIStore.getState().dialog?.title).toBe('Remove this cat?')
    expect(useSubmissionStore.getState().cats).toEqual(DEFAULT_CATS)

    await userEvent.press(screen.getByText('Remove'))

    expect(useSubmissionStore.getState().cats).toEqual([DEFAULT_CATS[0]])
    expect(screen.queryByText('Kitten · solid · long hair')).toBeNull()
    expect(screen.getByText('Adult · orange tabby · short hair')).toBeTruthy()
    expect(useUIStore.getState().dialog).toBeNull()
  })

  it('Edit opens Cat Form pre-filled for that cat, not another one', async () => {
    await userEvent.press(screen.getByText('Kitten · solid · long hair'))
    await userEvent.press(screen.getByText('Edit'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/submission/cats',
      params: { edit: 'cat-2' },
    })
  })

  it('Finished! calls handleDone', async () => {
    await userEvent.press(screen.getByText('Finished!'))
    expect(mockHandleDone).toHaveBeenCalledTimes(1)
  })

  it('Reset calls handleReset', async () => {
    await userEvent.press(screen.getByText('Reset'))
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
  })

  // The in-place case: still mounted, trash the last row. Distinct from the
  // two below, which mount already-empty — here the mount-time snapshot was
  // taken while cats existed. Pre-#299 this rendered null, so the user's own
  // delete blanked the screen out from under them.
  it('renders the choice, not a blank screen, when the last row is trashed in place', async () => {
    mockParams = {}
    useSubmissionStore.setState({ cats: [...DEFAULT_CATS] })
    render(<CreateSubmissionScreen />)
    await waitFor(() => expect(screen.getByText('Cats Recorded')).toBeTruthy())

    act(() => {
      useSubmissionStore.setState({ cats: [] })
    })

    expect(screen.getByText('Annotate Photos')).toBeTruthy()
    expect(screen.getByText('Describe a Cat')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })

  // #375: "Finished!" is disabled at zero cats, so the screen must say what
  // the user has to do first.
  it('says why Finished! is disabled while no cat is recorded', async () => {
    mockParams = { removed: '1' }
    render(<CreateSubmissionScreen />)

    await waitFor(() =>
      expect(screen.getByText(/Describe at least one cat/)).toBeTruthy(),
    )
    const finished = screen.getByText('Finished!')
    expect(finished).toBeDisabled()
    await userEvent.press(finished)
    expect(mockHandleDone).not.toHaveBeenCalled()
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

    await userEvent.press(screen.getByText('Describe a Cat'))
    expect(router.push).toHaveBeenCalledWith('/submission/cats')

    await userEvent.press(screen.getByText('Annotate Photos'))
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
