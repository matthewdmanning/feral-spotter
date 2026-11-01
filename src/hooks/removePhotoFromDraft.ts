/**
 * hooks/removePhotoFromDraft.ts
 * The one way to take a photo out of a draft, from any screen. A photo is
 * held in three stores and an upload: removing it from only the photo
 * store (the camera discard did) left its boxes and cat references behind.
 */

import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import { cancelPhotoUpload } from '@/src/lib/upload/draftUploads'
import { deleteSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'

export function removePhotoFromDraft(localId: string): void {
  const photo = usePhotoStore
    .getState()
    .photos.find((p) => p.local_id === localId)
  if (!photo) return
  cancelPhotoUpload(localId)
  useBoundingBoxStore.getState().removeBoxesForPhoto(localId)
  useSubmissionStore.getState().forgetPhoto(localId)
  usePhotoStore.getState().removePhoto(localId)
  // "No metadata ⇒ no photo" (#293): an uploaded copy of a removed photo
  // must not stay in the Submission folder.
  if (photo.uploaded && photo.cloud_storage_path) {
    void deleteSubmissionPhoto(photo.cloud_storage_path)
  }
}
