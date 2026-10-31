import { act, render, waitFor } from '@testing-library/react-native'
import { useDraftStartupStore } from '@/src/hooks/useDraftStartupStore'
import React from 'react'
import { getAllSubmissionCaches } from '@/src/lib/cache/submissionCache'
import HomeScreen from '../index'

/**
 * #314. Home's "Continue Observation" entry is read from the submission cache
 * inside an effect. That effect used to key on mount alone, and Home does not
 * unmount while Settings sits on top of it — so the answer went stale exactly
 * when it mattered:
 *
 * - Settings -> Clear Draft deleted the cache row and returned here, and Home
 *   still offered Continue Observation. Tapping it dead-ended on an empty
 *   annotate screen.
 * - The reverse also held: start a draft, come back, and the entry stayed
 *   hidden although a draft now existed.
 *
 * The failure worth catching is the gate answering from a previous visit.
 * Focus is faked directly rather than driven through a navigator: the
 * component's contract is "re-read when focused", and `useIsFocused` is the
 * seam it reads that through.
 */
let mockFocused = true

jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ isReady: true, isAuthenticated: true }),
}))
jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: () => true,
}))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn(),
}))
jest.mock('@/src/hooks/usePhotoStore', () => ({
  usePhotoStore: (sel: (s: { source: null }) => unknown) =>
    sel({ source: null }),
}))
jest.mock('@/src/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))
// Same stub as the sibling Home suites: the real column pulls in reanimated,
// which has no native part under jest. `visible` is the gate under test.
let capturedVisible = false
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  // The screen mounts the column only while it is shown.
  BottomButtonColumn: (props: { visible: boolean }) => {
    require('react').useEffect(() => {
      capturedVisible = props.visible
      return () => {
        capturedVisible = false
      }
    })
    return null
  },
}))

const mockGetAll = jest.mocked(getAllSubmissionCaches)

const draftInProgress = [
  { id: 's-1', status: 'In Progress', updated_at: new Date().toISOString() },
]

describe('Home resume entry re-reads on focus (#314)', () => {
  beforeEach(() => {
    useDraftStartupStore.setState({ phase: 'ready', task: Promise.resolve() })
    jest.clearAllMocks()
    mockFocused = true
    capturedVisible = false
  })

  it('reads resume state only after startup cleanup finishes', async () => {
    useDraftStartupStore.setState({ phase: 'cleaning' })
    mockGetAll.mockResolvedValue([])
    render(<HomeScreen />)
    expect(mockGetAll).not.toHaveBeenCalled()
    expect(capturedVisible).toBe(false)

    act(() => useDraftStartupStore.setState({ phase: 'ready' }))
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
    expect(capturedVisible).toBe(false)
  })

  it('drops the resume entry once the draft it referred to is gone', async () => {
    mockGetAll.mockResolvedValue(
      draftInProgress as unknown as Awaited<
        ReturnType<typeof getAllSubmissionCaches>
      >,
    )
    const { rerender } = render(<HomeScreen />)
    await waitFor(() => expect(capturedVisible).toBe(true))

    // Clear Draft deletes the row, then returns here. Home never unmounted.
    mockGetAll.mockResolvedValue([])
    mockFocused = false
    rerender(<HomeScreen />)
    mockFocused = true
    rerender(<HomeScreen />)

    await waitFor(() => expect(capturedVisible).toBe(false))
  })

  it('shows the resume entry once a draft exists, without remounting', async () => {
    mockGetAll.mockResolvedValue([])
    const { rerender } = render(<HomeScreen />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalled())
    expect(capturedVisible).toBe(false)

    mockGetAll.mockResolvedValue(
      draftInProgress as unknown as Awaited<
        ReturnType<typeof getAllSubmissionCaches>
      >,
    )
    mockFocused = false
    rerender(<HomeScreen />)
    mockFocused = true
    rerender(<HomeScreen />)

    await waitFor(() => expect(capturedVisible).toBe(true))
  })

  it('does not re-read while blurred', async () => {
    mockGetAll.mockResolvedValue([])
    const { rerender } = render(<HomeScreen />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))

    mockFocused = false
    rerender(<HomeScreen />)
    rerender(<HomeScreen />)

    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})
