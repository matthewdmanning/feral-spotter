/**
 * Fire-and-forget upload for a just-captured/picked photo, called right
 * after it's added to usePhotoStore. Updates the photo's uploaded/progress/
 * cloud_storage_* fields via the caller-supplied updatePhoto (no direct
 * store import — callers pass their own usePhotoStore((s) => s.updatePhoto)
 * selector, keeping this a pure function of its inputs). Failures are
 * logged and leave `uploaded: false` so useSubmissionSubmit's pre-submit
 * guard catches them.
 *
 * ponytail: no automatic retry on failure — the guard blocks submit until
 * the user retries (re-add the photo), add background retry if field
 * reports show uploads getting stuck.
 */
import { uploadSubmissionPhoto } from '@/src/lib/upload/firebaseUpload'
import type { SubmissionPhoto } from '@/src/types'

export function uploadNewPhoto(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
  updatePhoto: (localId: string, patch: Partial<SubmissionPhoto>) => void,
): void {
  uploadSubmissionPhoto(photo, uid, submissionId, (percent) => {
    updatePhoto(photo.local_id, { upload_progress: percent })
  })
    .then(({ cloud_storage_path, cloud_storage_url }) => {
      updatePhoto(photo.local_id, {
        uploaded: true,
        upload_progress: 100,
        cloud_storage_path,
        cloud_storage_url,
      })
    })
    .catch((error) => {
      console.error('[uploadNewPhoto]', photo.local_id, error)
    })
}
