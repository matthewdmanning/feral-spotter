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

import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  cancelPhotoUpload as cancelQueuedPhoto,
  cancelQueuedUploads,
  isQueueIdle,
  onQueueChange,
  uploadNewPhoto,
} from '@/src/lib/upload/uploadNewPhoto'

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
    if (!photo.uploaded) uploadNewPhoto(photo, uid, submissionId, updatePhoto)
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
      if (photos.every((p) => p.uploaded)) finish('uploaded')
      else if (isQueueIdle()) finish('failed')
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    const unsubscribeStore = usePhotoStore.subscribe(check)
    const unsubscribeQueue = onQueueChange(check)
    check()
  })
}
