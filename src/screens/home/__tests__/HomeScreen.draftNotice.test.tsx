import { APP_STARTED_AT } from '@/src/shared/config/constants'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { render, screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import HomeScreen from '../index'
import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'

/**
 * #424: Home's notice for a photo draft. A draft restored from an earlier
 * session offers Finish; one begun this session offers Reset behind a
 * confirmation. Real photo and UI stores, so the origin comes from the
 * store's own timestamp.
 */
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))
jest.mock('@/src/features/auth/lib/useAuth', () => ({
  useAuth: () => ({ isReady: true, isAuthenticated: true }),
}))
jest.mock('@/src/shared/consent/useConsentStore', () => ({
  hasAcceptedConsent: () => true,
}))
jest.mock('@/src/features/draft-submission/lib/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/src/shared/ui/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))
jest.mock('@/src/features/library-picker/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))

const seedPool = (updatedAt: number) => {
  usePhotoStore.setState({
    photos: [
      {
        local_id: 'photo-1',
        uri: 'file:///photo-1.jpg',
        uploaded: false,
        upload_progress: 0,
        width: 100,
        height: 100,
      },
    ],
    source: 'camera',
    submissionId: 'submission-1',
    updated_at: updatedAt,
  })
}

describe('HomeScreen photo draft notice (#424)', () => {
  beforeEach(() => {
    useDraftStartupStore.setState({ phase: 'ready', task: Promise.resolve() })
    jest.clearAllMocks()
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    useUIStore.setState({ dialog: null })
  })

  it('opens the camera while restoration is pending without offering stale draft actions', async () => {
    useDraftStartupStore.setState({ phase: 'restoring' })
    seedPool(APP_STARTED_AT - 1)
    render(<HomeScreen />)
    expect(screen.queryByText('Finish')).toBeNull()
    expect(screen.queryByText('Reset')).toBeNull()
    expect(screen.getByLabelText('Upload Photos')).toBeDisabled()
    await userEvent.setup().press(screen.getByLabelText('Take Photos'))
    expect(router.navigate).toHaveBeenCalledWith('/camera')
  })

  it('shows nothing while the pool is empty', () => {
    render(<HomeScreen />)
    expect(screen.queryByText('Finish')).toBeNull()
    expect(screen.queryByText('Reset')).toBeNull()
  })

  it('offers Finish and Reset for a restored draft, and Finish opens the report', async () => {
    seedPool(APP_STARTED_AT - 1)
    render(<HomeScreen />)
    expect(
      screen.getByText(
        'You have an unfinished submission with camera photos. Finish or reset it to use Upload Photos.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('Reset')).toBeOnTheScreen()

    await userEvent.setup().press(screen.getByText('Finish'))
    expect(router.push).toHaveBeenCalledWith('/submission/create')
  })

  it('asks before discarding a restored draft', async () => {
    seedPool(APP_STARTED_AT - 1)
    render(<HomeScreen />)

    await userEvent.setup().press(screen.getByText('Reset'))
    expect(useUIStore.getState().dialog?.title).toBe('Reset Submission')
    expect(usePhotoStore.getState().photos).toHaveLength(1)
  })

  it('offers Reset for an in-session draft, and Reset asks before discarding', async () => {
    seedPool(APP_STARTED_AT + 1)
    render(<HomeScreen />)
    expect(
      screen.getByText(
        'This submission uses camera photos. Reset it to use Upload Photos.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Finish')).toBeNull()

    await userEvent.setup().press(screen.getByText('Reset'))
    expect(useUIStore.getState().dialog?.title).toBe('Reset Submission')
    expect(usePhotoStore.getState().photos).toHaveLength(1)
  })
})
