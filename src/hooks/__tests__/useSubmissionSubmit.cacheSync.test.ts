import { useUIStore } from '@/src/hooks/useUIStore'
import { act, renderHook } from '@testing-library/react-native'

import * as cache from '@/src/lib/cache/submissionCache'
import { uploadSubmissionMetadata } from '@/src/lib/upload/firebaseUpload'
import { useSubmissionSubmit } from '../useSubmissionSubmit'
import { useSubmissionStore } from '../useSubmissionStore'
import { usePhotoStore } from '../usePhotoStore'

/**
 * Regression check for #228: updateSubmissionCache replaces `metadata`
 * wholesale (no deep merge — see submissionCache.ts), so a submit that
 * only patched status/cats/photo_links silently dropped manual_time set
 * after the cache's initial creation (the EXIF-less Library-pick path,
 * ADR 0003 / #224).
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
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
  uploadSubmissionMetadata: jest.fn().mockResolvedValue(undefined),
  finalizeSubmissionPhotoMetadata: jest.fn().mockResolvedValue(undefined),
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
  photo_local_ids: ['photo-1'],
  photos_reviewed: true,
})

const photo = (id: string) => ({
  local_id: id,
  uri: `file://${id}.jpg`,
  cloud_storage_path: `submissions/uid-owner/sub-1/${id}.jpg`,
  cloud_storage_url: `https://cdn.example/${id}.jpg`,
  uploaded: true,
  upload_progress: 100,
  width: 100,
  height: 100,
})

describe('useSubmissionSubmit — handleDone cache sync (#228)', () => {
  beforeEach(async () => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    jest.spyOn(cache, 'updateSubmissionCache')
    useUIStore.setState({ dialog: null, isSubmitting: false })
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.setState({ photos: [], source: null, submissionId: 'sub-1' })
    useSubmissionStore.getState().addCat(cat('cat-1'))
    usePhotoStore.getState().addPhoto(photo('photo-1'))
    await cache.createSubmissionCache('cache-1', {
      location_method: 'device',
      time_method: 'device',
    })
  })

  it('includes the current manual_time/time_type in the cache update on submit', async () => {
    useSubmissionStore.getState().setSubmission({ time_type: 'manual' })
    useSubmissionStore.getState().setManualTime('2026-08-01T12:00:00.000Z')

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
      const confirm = useUIStore
        .getState()
        .dialog?.buttons.find((b) => b.text === 'Submit')
      expect(confirm?.onPress).toEqual(expect.any(Function))
      await confirm!.onPress!()
    })

    expect(cache.updateSubmissionCache).toHaveBeenCalledWith(
      'cache-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          time_method: 'manual',
          manual_time: '2026-08-01T12:00:00.000Z',
        }),
      }),
    )
    expect(await cache.getSubmissionCache('cache-1')).toEqual(
      expect.objectContaining({
        status: 'Submitted',
        metadata: expect.objectContaining({
          time_method: 'manual',
          manual_time: '2026-08-01T12:00:00.000Z',
        }),
      }),
    )
    expect(await cache.getCurrentCacheId()).toBeNull()
  })
})
