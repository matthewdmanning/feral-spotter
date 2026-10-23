import { useUIStore } from '@/src/hooks/useUIStore'
import { act, renderHook } from '@testing-library/react-native'

import { stopLocationCapture } from '@/src/lib/location'
import { useSubmissionSubmit } from '../useSubmissionSubmit'
import { useSubmissionStore } from '../useSubmissionStore'
import { usePhotoStore } from '../usePhotoStore'

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

jest.mock('@/src/lib/cache/submissionCache', () => ({
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
  deleteSubmissionCache: jest.fn().mockResolvedValue(undefined),
  updateSubmissionCache: jest.fn().mockResolvedValue(undefined),
  getSubmissionCache: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/src/lib/location', () => ({
  stopLocationCapture: jest.fn(),
}))

jest.mock('@/src/lib/analytics/analytics', () => ({
  fireAnalyticsEvent: jest.fn(),
  EVENTS: {
    SUBMISSION_SENDING: 'x',
    SUBMISSION_SUBMITTED: 'y',
    SUBMISSION_FAILED: 'z',
  },
}))

jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  uploadSubmissionMetadata: jest.fn(),
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-owner' } }),
}))

const cat = (id: string) => ({
  local_id: id,
  age: 'adult' as const,
  ear_tipped: 'unsure' as const,
  owned_domesticated: 'unsure' as const,
  pattern: 'solid' as const,
  hair_length: 'short' as const,
  color: 'black' as const,
  sex: 'unknown' as const,
  health_label: 'unknown' as const,
  photo_local_ids: ['p1'],
  photos_reviewed: true,
})

const photo = (id: string) => ({
  local_id: id,
  uri: `file://${id}.jpg`,
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
})

describe('useSubmissionSubmit — handleReset (#189)', () => {
  beforeEach(() => {
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.setState({ photos: [], source: null })
    useSubmissionStore.getState().addCat(cat('cat-1'))
    usePhotoStore.getState().addPhoto(photo('photo-1'))
  })

  it('clears cats and photos from the real stores on Reset confirm', async () => {
    expect(useSubmissionStore.getState().cats).toHaveLength(1)
    expect(usePhotoStore.getState().photos).toHaveLength(1)

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleReset()
      const confirm = useUIStore
        .getState()
        .dialog?.buttons.find((b) => b.text === 'Reset')
      expect(confirm?.onPress).toEqual(expect.any(Function))
      await confirm!.onPress!()
    })

    expect(useSubmissionStore.getState().cats).toEqual([])
    expect(usePhotoStore.getState().photos).toEqual([])
    expect(stopLocationCapture).toHaveBeenCalled()
  })
})
