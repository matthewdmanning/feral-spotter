import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { act, renderHook } from '@testing-library/react-native'
import { pressDialogButton } from '@/src/test-utils/dialog'

import { stopLocationCapture } from '@/src/core/location/liveFix'
import { useSubmissionSubmit } from '@/src/features/draft-submission/hooks/useSubmissionSubmit'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'

/**
 * Regression check for #189 (Reset button reported not to clear the
 * submission live on-device): drives the real handleReset callback
 * against the real, persisted useSubmissionStore/usePhotoStore — not
 * mocks of them — since the reported symptom is that cleared state
 * doesn't stick, which a mocked store could hide.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/src/shared/lib/submissionCache', () => ({
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
  deleteSubmissionCache: jest.fn().mockResolvedValue(undefined),
  updateSubmissionCache: jest.fn().mockResolvedValue(undefined),
  getSubmissionCache: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  stopLocationCapture: jest.fn(),
}))

jest.mock('@/src/features/draft-submission/lib/analytics', () => ({
  fireAnalyticsEvent: jest.fn(),
}))

jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  uploadSubmissionMetadata: jest.fn(),
}))

const cat = (id: string) =>
  observedCat({
    local_id: id,
    photo_local_ids: ['p1'],
    photos_reviewed: true,
  })

const photo = (id: string) => submissionPhoto({ local_id: id })

describe('useSubmissionSubmit — handleReset (#189)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { uid: 'uid-owner' } as never,
      isReady: true,
    })
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.setState({ photos: [], source: null })
    useSubmissionStore.getState().addCat(cat('cat-1'))
    usePhotoStore.getState().addPhoto(photo('photo-1'))
  })

  it('clears cats and photos from the real stores on Reset confirm', async () => {
    expect(useSubmissionStore.getState().cats).toHaveLength(1)
    expect(usePhotoStore.getState().photos).toHaveLength(1)

    const { result } = await renderHook(() => useSubmissionSubmit())

    act(() => result.current.handleReset())
    await pressDialogButton('Reset')

    expect(useSubmissionStore.getState().cats).toEqual([])
    expect(usePhotoStore.getState().photos).toEqual([])
    expect(stopLocationCapture).toHaveBeenCalled()
  })
})
