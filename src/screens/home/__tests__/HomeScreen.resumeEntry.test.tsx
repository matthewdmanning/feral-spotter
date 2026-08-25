import { render, waitFor } from '@testing-library/react-native'
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

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: () => anyProp() })
  const knownTokens = {
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    radius: { sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, full: 9999 },
    typography: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 },
  }
  const theme = new Proxy(knownTokens, {
    get: (t, k: string) => (k in t ? t[k as keyof typeof t] : anyProp()),
  })
  const withVariants = (obj: object) =>
    Object.assign(obj, { useVariants: jest.fn() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) =>
        withVariants(typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
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
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

// Same stub as the sibling Home suites: the real column pulls in reanimated,
// which has no native part under jest. `visible` is the gate under test.
let capturedVisible = false
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: (props: { visible: boolean }) => {
    capturedVisible = props.visible
    return null
  },
}))

const mockGetAll = jest.mocked(getAllSubmissionCaches)

const draftInProgress = [
  { id: 's-1', status: 'In Progress', updated_at: new Date().toISOString() },
]

describe('Home resume entry re-reads on focus (#314)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFocused = true
    capturedVisible = false
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
