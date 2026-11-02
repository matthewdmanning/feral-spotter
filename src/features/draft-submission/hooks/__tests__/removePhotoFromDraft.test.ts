import { deleteSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { cancelPhotoUpload } from '@/src/features/draft-submission/lib/upload/uploadNewPhoto'
import { observedCat } from '@/src/test-utils/catFixtures'
import { removePhotoFromDraft } from '@/src/features/draft-submission/hooks/removePhotoFromDraft'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'

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
  expect(deleteSubmissionPhoto).toHaveBeenCalledWith('cloud/p1')
})

it('deletes no cloud copy for a photo that never finished uploading', () => {
  removePhotoFromDraft('p2')
  expect(cancelPhotoUpload).toHaveBeenCalledWith('p2')
  expect(deleteSubmissionPhoto).not.toHaveBeenCalled()
})
