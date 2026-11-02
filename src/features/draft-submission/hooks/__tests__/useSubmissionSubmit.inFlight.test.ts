import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { act, renderHook } from '@testing-library/react-native'

import * as cache from '@/src/features/draft-submission/lib/submissionCache'
import {
  uploadSubmissionMetadata,
  uploadSubmissionPhoto,
} from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { discardDraftAndGoHome } from '@/src/features/draft-submission/hooks/confirmResetSubmission'
import { useSubmissionSubmit } from '@/src/features/draft-submission/hooks/useSubmissionSubmit'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { observedCat } from '@/src/test-utils/catFixtures'

/**
 * A submit waits up to 30 s for background uploads. During that wait the
 * draft must not change under it: a Reset there used to empty the photo
 * pool, end the wait, and send the cats with no photos. A second tap used
 * to start a second send. A photo whose upload had already failed was never
 * retried, so the wait could only time out.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))
jest.mock('@/src/core/location/liveFix', () => ({
  stopLocationCapture: jest.fn(),
}))
jest.mock('@/src/features/draft-submission/lib/analytics', () => ({
  fireAnalyticsEvent: jest.fn(),
}))
jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  uploadSubmissionMetadata: jest.fn(),
  finalizeSubmissionPhotoMetadata: jest.fn().mockResolvedValue(undefined),
  uploadSubmissionPhoto: jest.fn(),
  deleteSubmissionUploads: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/src/features/auth/lib', () => ({
  authProvider: {
    getCurrentUser: () => ({ uid: 'uid-owner' }),
    onAuthStateChanged: () => () => {},
  },
}))

const pendingPhoto = {
  local_id: 'photo-1',
  uri: 'file://photo-1.jpg',
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
}

function markUploaded() {
  usePhotoStore.getState().updatePhoto('photo-1', {
    uploaded: true,
    upload_progress: 100,
    cloud_storage_path: 'submissions/uid-owner/sub-1/photo-1.jpg',
    cloud_storage_url: 'https://cdn.example/photo-1.jpg',
  })
}

function confirmSubmit(): Promise<void> | void {
  const confirm = useUIStore
    .getState()
    .dialog?.buttons.find((b) => b.text === 'Submit')
  useUIStore.setState({ dialog: null })
  return confirm!.onPress!() as Promise<void> | void
}

beforeEach(async () => {
  useAuthStore.setState({ user: { uid: 'uid-owner' } as never, isReady: true })
  jest.useFakeTimers()
  jest.clearAllMocks()
  // The upload never finishes on its own; each test decides when it lands.
  jest.mocked(uploadSubmissionPhoto).mockReturnValue(new Promise(() => {}))
  jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)
  useUIStore.setState({ dialog: null, isSubmitting: false })
  useSubmissionStore.getState().clearDraft()
  usePhotoStore.setState({ photos: [], source: null, submissionId: 'sub-1' })
  usePhotoStore.getState().addPhoto(pendingPhoto)
  useSubmissionStore.getState().addCat(observedCat())
  await cache.createSubmissionCache('cache-1', {
    location_method: 'device',
    time_method: 'device',
  })
})

afterEach(() => jest.useRealTimers())

it('locks the draft while it waits, re-queues the stuck upload, and sends once', async () => {
  const { result } = await renderHook(() => useSubmissionSubmit())
  await act(() => result.current.handleDone())
  let sending!: Promise<void> | void
  await act(() => {
    sending = confirmSubmit()
  })
  expect(result.current.isSubmitting).toBe(true)
  // The photo had no upload running; Submit started one.
  expect(uploadSubmissionPhoto).toHaveBeenCalledTimes(1)

  // Mid-wait: a second Submit Sighting opens nothing, and Reset clears nothing.
  await act(() => result.current.handleDone())
  expect(useUIStore.getState().dialog).toBeNull()
  await act(() => discardDraftAndGoHome())
  expect(usePhotoStore.getState().photos).toHaveLength(1)

  markUploaded()
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600)
    await sending
  })
  expect(uploadSubmissionMetadata).toHaveBeenCalledTimes(1)
  expect(jest.mocked(uploadSubmissionMetadata).mock.calls[0][0]).toEqual(
    expect.objectContaining({ photo_paths: [expect.any(String)] }),
  )
  expect((await cache.getSubmissionCache('cache-1'))?.status).toBe('Submitted')
  expect(result.current.isSubmitting).toBe(false)
})

it('does not send when the draft is cleared during the wait', async () => {
  const { result } = await renderHook(() => useSubmissionSubmit())
  await act(() => result.current.handleDone())
  let sending!: Promise<void> | void
  await act(() => {
    sending = confirmSubmit()
  })
  // Torn down by a path that does not go through the lock.
  await act(async () => {
    usePhotoStore.getState().clearPhotos(true)
  })
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600)
    await sending
  })
  expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
  expect((await cache.getSubmissionCache('cache-1'))?.status).toBe(
    'In Progress',
  )
  expect(useUIStore.getState().isSubmitting).toBe(false)
})

it('marks the row Failed and unlocks when the send is rejected', async () => {
  markUploaded()
  jest.mocked(uploadSubmissionMetadata).mockRejectedValue(new Error('down'))
  const { result } = await renderHook(() => useSubmissionSubmit())
  await act(() => result.current.handleDone())
  await act(async () => {
    await confirmSubmit()
  })
  expect((await cache.getSubmissionCache('cache-1'))?.status).toBe('Failed')
  expect(useUIStore.getState().dialog?.title).toBe('Sighting Failed')
  expect(useUIStore.getState().isSubmitting).toBe(false)
  // The draft is intact for the retry the message promises.
  expect(usePhotoStore.getState().photos).toHaveLength(1)
})
