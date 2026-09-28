/**
 * Background upload for a just-captured or just-picked photo, called right
 * after it's added to usePhotoStore. Updates the photo's uploaded/progress/
 * cloud_storage_* fields via the caller-supplied updatePhoto — callers pass
 * their own usePhotoStore((s) => s.updatePhoto) selector, so this file never
 * imports the store and stays easy to drive from a test. Failures are logged
 * and leave `uploaded: false` so useSubmissionSubmit's pre-submit guard
 * catches them.
 *
 * Uploads are queued rather than started immediately. A burst calls this once
 * per frame, and an uncapped fan-out puts every frame's upload in competition
 * with the capture path and with each other on a slow connection.
 *
 * ponytail: no automatic retry on failure — the guard blocks submit until
 * the user retries (re-add the photo), add background retry if field
 * reports show uploads getting stuck.
 */
import { uploadSubmissionPhoto } from '@/src/lib/upload/firebaseUpload'
import type { SubmissionPhoto } from '@/src/types'
import { LogBox } from 'react-native'

// Keeps the failure in Metro's console for debugging without popping an
// on-screen LogBox notification for every failed background upload — the
// photo's own `uploaded: false` status already surfaces the failure in the UI.
LogBox.ignoreLogs(['[uploadNewPhoto]'])

/**
 * Two at a time: enough to keep the connection busy while one upload is
 * negotiating, few enough that a burst cannot starve the capture path.
 *
 * ponytail: a fixed cap, not adaptive — raise it or drive it from NetInfo if
 * upload throughput on a good connection turns out to be the complaint.
 */
const MAX_CONCURRENT_UPLOADS = 2

/**
 * Storage reports progress every chunk. Writing each one into the store means
 * one re-render per chunk per in-flight photo, which lands on the UI thread
 * while the camera is still working. One update per 250ms per photo is enough
 * for a progress bar to look continuous.
 */
const PROGRESS_UPDATE_INTERVAL_MS = 250

const queued: (() => Promise<void>)[] = []
let activeUploadCount = 0

function startNextUpload(): void {
  if (activeUploadCount >= MAX_CONCURRENT_UPLOADS) return
  const next = queued.shift()
  if (!next) return

  activeUploadCount += 1
  void next().finally(() => {
    activeUploadCount -= 1
    startNextUpload()
  })
}

export function uploadNewPhoto(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
  updatePhoto: (localId: string, patch: Partial<SubmissionPhoto>) => void,
): void {
  queued.push(async () => {
    let lastProgressAt = 0
    try {
      const { cloud_storage_path, cloud_storage_url } =
        await uploadSubmissionPhoto(photo, uid, submissionId, (percent) => {
          const now = Date.now()
          if (now - lastProgressAt < PROGRESS_UPDATE_INTERVAL_MS) return
          lastProgressAt = now
          updatePhoto(photo.local_id, { upload_progress: percent })
        })
      updatePhoto(photo.local_id, {
        uploaded: true,
        upload_progress: 100,
        cloud_storage_path,
        cloud_storage_url,
      })
    } catch (error) {
      console.error('[uploadNewPhoto]', photo.local_id, error)
    }
  })
  startNextUpload()
}
