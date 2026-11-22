/**
 * lib/upload/draftUploads.ts
 * The current draft's photo uploads, as one facade. Callers say what they
 * want ("make sure every photo is uploading", "this photo is gone", "wait
 * until uploads settle"); the facade reads the signed-in uid, the draft's
 * Submission id and each photo's stored (slotted) copy itself. Callers used
 * to assemble those by hand at five call sites, and one uploaded a photo
 * before its slot existed.
 *
 * The queue (uploadNewPhoto.ts) does the transfers; uploadSubmissionPhoto
 * (firebaseUpload.ts) is the Storage seam tests fake.
 */

import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  cancelPhotoUpload as cancelQueuedPhoto,
  cancelQueuedUploads,
  isQueueIdle,
  onQueueChange,
  uploadNewPhoto,
} from '@/src/features/draft-submission/lib/upload/uploadNewPhoto'
import { deleteSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import {
  photoObjectPath,
  rawPhotoObjectPath,
} from '@/src/features/draft-submission/lib/upload/submissionLayout'
import { reservePhotoSlot } from '@/src/features/draft-submission/lib/upload/photoSlotQueue'
import type { PhotoUploadResponse, SubmissionPhoto } from '@/src/shared/types'

/** Use this function to remove artifacts from a canceled upload after its slot tail. */
async function cleanupStaleUpload(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
  result?: PhotoUploadResponse,
): Promise<void> {
  const jpegPath =
    result?.cloud_storage_path ??
    (photo.upload_slot == null
      ? undefined
      : (photo.cloud_storage_path ??
        photoObjectPath(uid, submissionId, photo.upload_slot)))
  const dngPath =
    result?.raw_cloud_storage_path ??
    (photo.raw_uri && photo.upload_slot != null
      ? (photo.raw_cloud_storage_path ??
        rawPhotoObjectPath(uid, submissionId, photo.upload_slot))
      : undefined)
  await deleteSubmissionPhoto(
    ...([jpegPath, dngPath].filter(Boolean) as string[]),
  )
}

/** Use this function to delete a removed photo after any same-slot upload settles. */
export function deletePhotoUploads(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
): void {
  const resolvedPaths =
    photo.upload_slot == null
      ? [photo.cloud_storage_path, photo.raw_cloud_storage_path]
      : [
          photo.cloud_storage_path ??
            photoObjectPath(uid, submissionId, photo.upload_slot),
          photo.raw_cloud_storage_path ??
            (photo.raw_uri
              ? rawPhotoObjectPath(uid, submissionId, photo.upload_slot)
              : undefined),
        ]
  if (photo.upload_slot == null) {
    void deleteSubmissionPhoto(...(resolvedPaths.filter(Boolean) as string[]))
    return
  }
  const reservation = reservePhotoSlot(
    `${uid}/${submissionId}/${photo.upload_slot}`,
  )
  void reservation.wait
    .then(() =>
      deleteSubmissionPhoto(...(resolvedPaths.filter(Boolean) as string[])),
    )
    .finally(reservation.release)
}

/**
 * Queues every photo in the draft that is not uploaded yet, using its
 * stored copy. Safe to call at any time and repeatedly: a photo already
 * queued or in flight is not queued again. Without a signed-in user or a
 * draft it does nothing.
 */
export function syncPhotoUploads(): void {
  const uid = useAuthStore.getState().user?.uid
  const { photos, submissionId, updatePhoto } = usePhotoStore.getState()
  if (!uid || !submissionId) {
    if (photos.some((p) => !p.uploaded)) {
      console.error('[draftUploads] no uid/submissionId: uploads not queued')
    }
    return
  }
  for (const photo of photos) {
    const needsRaw =
      photo.raw_uri != null && photo.raw_cloud_storage_path == null
    if (!photo.uploaded && !needsRaw) {
      uploadNewPhoto(photo, uid, submissionId, updatePhoto, (result) =>
        cleanupStaleUpload(photo, uid, submissionId, result),
      )
      continue
    }
    if (needsRaw) {
      // A pre-pair persisted photo may have marked the JPEG uploaded. Until
      // the DNG succeeds it is not a complete upload and must remain retryable.
      if (photo.uploaded)
        updatePhoto(photo.local_id, { uploaded: false, upload_progress: 0 })
      uploadNewPhoto(photo, uid, submissionId, updatePhoto, (result) =>
        cleanupStaleUpload(photo, uid, submissionId, result),
      )
    }
  }
}

/** A removed photo's upload stops and never writes its result. */
export function cancelPhotoUpload(localId: string): void {
  cancelQueuedPhoto(localId)
}

/** The draft is gone: drop every upload. */
export function cancelPhotoUploads(): void {
  cancelQueuedUploads()
}

export type UploadsOutcome = 'uploaded' | 'failed' | 'timeout'

/**
 * Resolves once the draft's uploads settle:
 * - 'uploaded' when every photo is uploaded,
 * - 'failed' when nothing is uploading but some photo is not uploaded
 *   (a failure is reported at once, not after the timeout),
 * - 'timeout' when uploads are still running after `timeoutMs`.
 */
export function whenUploadsSettled(timeoutMs: number): Promise<UploadsOutcome> {
  return new Promise((resolve) => {
    let done = false
    const finish = (outcome: UploadsOutcome) => {
      if (done) return
      done = true
      clearTimeout(timer)
      unsubscribeStore()
      unsubscribeQueue()
      resolve(outcome)
    }
    const check = () => {
      const { photos } = usePhotoStore.getState()
      if (
        photos.every(
          (p) =>
            p.uploaded &&
            (p.raw_uri == null || p.raw_cloud_storage_path != null),
        )
      )
        finish('uploaded')
      else if (isQueueIdle()) finish('failed')
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    const unsubscribeStore = usePhotoStore.subscribe(check)
    const unsubscribeQueue = onQueueChange(check)
    check()
  })
}
