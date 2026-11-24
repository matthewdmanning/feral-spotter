import { parseExifDateTime } from '@/src/shared/utils/libraryPickTime'
import { deleteSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { cancelPhotoUpload } from '@/src/features/draft-submission/lib/upload/uploadNewPhoto'
import { observedCat } from '@/src/test-utils/catFixtures'
import { removePhotoFromDraft } from '@/src/features/draft-submission/hooks/removePhotoFromDraft'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

/**
 * A photo lives in three stores and an upload. The camera's discard used to
 * clear only the photo store, so a photo boxed earlier left its boxes and
 * its cat's references behind, and its upload kept running.
 */

jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  deleteSubmissionPhoto: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/src/features/draft-submission/lib/upload/uploadNewPhoto', () => ({
  cancelPhotoUpload: jest.fn(),
}))

const BOX = {
  lowerLeftX: 0.1,
  lowerLeftY: 0.9,
  upperRightX: 0.6,
  upperRightY: 0.2,
}

beforeEach(() => {
  jest.clearAllMocks()
  usePhotoStore.getState().clearPhotos(true)
  useBoundingBoxStore.getState().clearAll()
  useSubmissionStore.getState().clearDraft()
  usePhotoStore.getState().addPhotos([
    {
      local_id: 'p1',
      uri: 'file:///p1.jpg',
      uploaded: true,
      upload_progress: 100,
      width: 10,
      height: 10,
      cloud_storage_path: 'cloud/p1',
      raw_cloud_storage_path: 'cloud/p1.dng',
    },
    {
      local_id: 'p2',
      uri: 'file:///p2.jpg',
      uploaded: false,
      upload_progress: 0,
      width: 10,
      height: 10,
    },
  ])
  useBoundingBoxStore.getState().addBox('cat-1', 'p1', BOX)
  useBoundingBoxStore.getState().addBox('cat-1', 'p2', BOX)
  useSubmissionStore.getState().addCat({
    ...observedCat({ local_id: 'cat-1' }),
    photo_local_ids: ['p1', 'p2'],
    profile_photo_local_id: 'p1',
  })
})

it('removes the photo from every store, its upload and its cloud copy', () => {
  removePhotoFromDraft('p1')

  expect(usePhotoStore.getState().photos.map((p) => p.local_id)).toEqual(['p2'])
  expect(
    useBoundingBoxStore
      .getState()
      .getBoxesForCat('cat-1')
      .map((b) => b.photo_local_id),
  ).toEqual(['p2'])
  const cat = useSubmissionStore.getState().cats[0]
  expect(cat.photo_local_ids).toEqual(['p2'])
  expect(cat.profile_photo_local_id).toBeUndefined()
  expect(cancelPhotoUpload).toHaveBeenCalledWith('p1')
  expect(deleteSubmissionPhoto).toHaveBeenCalledWith('cloud/p1', 'cloud/p1.dng')
})

it('deletes partial pair objects after a DNG failure', async () => {
  useAuthStore.setState({ user: { uid: 'uid-1' } as never, isReady: true })
  usePhotoStore.setState({ submissionId: 'sub-1' })
  usePhotoStore.getState().updatePhoto('p2', { raw_uri: 'file:///p2.dng' })

  removePhotoFromDraft('p2')
  await new Promise((resolve) => setImmediate(resolve))
  expect(cancelPhotoUpload).toHaveBeenCalledWith('p2')
  expect(deleteSubmissionPhoto).toHaveBeenCalledWith(
    'submissions/uid-1/sub-1/photo-1.jpg',
    'submissions/uid-1/sub-1/photo-1.dng',
  )
})

// LOGIC-2: draft-level location and time must follow the pool. A Library
// draft emptied and continued from the camera used to keep the old pin and
// time, so the Live fix was ignored and camera photos took the pin.
describe('draft location and time after a removal', () => {
  const exifIso = (raw: string) => parseExifDateTime(raw)

  beforeEach(() => {
    usePhotoStore.getState().updatePhoto('p1', {
      exif: { timestamp: '2026:08:01 10:00:00' },
    })
    usePhotoStore.getState().updatePhoto('p2', {
      exif: { timestamp: '2026:08:01 09:00:00' },
    })
    const submission = useSubmissionStore.getState()
    submission.setLocationType('pin')
    submission.setSubmissionLocation({ latitude: 34.68, longitude: -82.83 })
    submission.setLibraryTime({
      time_type: 'device',
      captured_at: exifIso('2026:08:01 09:00:00'),
    })
  })

  it('resets to device location and time when the pool empties', () => {
    removePhotoFromDraft('p1')
    removePhotoFromDraft('p2')

    expect(useSubmissionStore.getState().submission).toMatchObject({
      location_type: 'device',
      latitude: undefined,
      longitude: undefined,
      time_type: 'device',
      captured_at: undefined,
      manual_time: undefined,
    })
  })

  it('reclassifies time over the Library photos that remain', () => {
    removePhotoFromDraft('p2')

    expect(useSubmissionStore.getState().submission).toMatchObject({
      location_type: 'pin',
      latitude: 34.68,
      time_type: 'device',
      captured_at: exifIso('2026:08:01 10:00:00'),
    })
  })

  it('leaves manual time once the photo without EXIF time is removed', () => {
    usePhotoStore.getState().updatePhoto('p2', { exif: undefined })
    useSubmissionStore.getState().setLibraryTime({ time_type: 'manual' })

    removePhotoFromDraft('p2')

    expect(useSubmissionStore.getState().submission).toMatchObject({
      time_type: 'device',
      captured_at: exifIso('2026:08:01 10:00:00'),
    })
  })
})
