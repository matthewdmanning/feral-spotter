/**
 * hooks/removePhotoFromDraft.ts
 * The one way to take a photo out of a draft, from any screen. A photo is
 * held in three stores and an upload: removing it from only the photo
 * store (the camera discard did) left its boxes and cat references behind.
 */

import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  cancelPhotoUpload,
  deletePhotoUploads,
} from '@/src/features/draft-submission/lib/upload/draftUploads'
import { deleteSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import {
  classifyLibraryPickTime,
  parseExifDateTime,
} from '@/src/shared/utils/libraryPickTime'

export function removePhotoFromDraft(localId: string): void {
  const photo = usePhotoStore
    .getState()
    .photos.find((p) => p.local_id === localId)
  if (!photo) return
  const submissionId = usePhotoStore.getState().submissionId
  const uid = useAuthStore.getState().user?.uid
  // Reserve the remote mutation before publishing the slot as free. A store
  // subscriber can synchronously add a replacement after removePhoto().
  if (
    uid &&
    submissionId &&
    photo.upload_slot != null &&
    (photo.cloud_storage_path || photo.raw_cloud_storage_path || photo.raw_uri)
  ) {
    // A failed pair may have written only the JPEG before the DNG failed, so
    // derive both stable paths even when the store never received a response.
    deletePhotoUploads(photo, uid, submissionId)
  } else if (photo.cloud_storage_path) {
    void deleteSubmissionPhoto(
      photo.cloud_storage_path,
      ...(photo.raw_cloud_storage_path ? [photo.raw_cloud_storage_path] : []),
    )
  }
  cancelPhotoUpload(localId)
  useBoundingBoxStore.getState().removeBoxesForPhoto(localId)
  useSubmissionStore.getState().forgetPhoto(localId)
  usePhotoStore.getState().removePhoto(localId)
  rederiveSourceMetadata()
}

/**
 * LOGIC-2: draft-level location and time follow the pool. An empty pool
 * resets them to device, so a camera continuation takes the Live fix. A
 * Library removal reclassifies time over the photos that remain.
 */
function rederiveSourceMetadata(): void {
  const { photos, source } = usePhotoStore.getState()
  const submissionStore = useSubmissionStore.getState()
  if (photos.length === 0) {
    submissionStore.resetSourceMetadata()
  } else if (source === 'library') {
    submissionStore.setLibraryTime(
      classifyLibraryPickTime(
        photos.map((p) => parseExifDateTime(p.exif?.timestamp)),
      ),
    )
  }
}
