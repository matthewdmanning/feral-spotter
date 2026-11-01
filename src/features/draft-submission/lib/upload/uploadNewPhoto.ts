/**
 * The upload queue under lib/upload/draftUploads.ts. App code calls the
 * draft-level facade there; this file knows nothing about drafts or stores.
 * Updates a photo's uploaded/progress/cloud_storage_* fields through the
 * supplied updatePhoto. Failures are logged and leave `uploaded: false`.
 *
 * Uploads are queued rather than started immediately. A burst calls this once
 * per frame, and an uncapped fan-out puts every frame's upload in competition
 * with the capture path and with each other on a slow connection.
 *
 * A failed upload is not retried on its own; the facade re-queues it. A
 * photo already queued or in flight is never queued twice.
 */
import { uploadSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import type { SubmissionPhoto } from '@/src/shared/types'
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

const queued: { localId: string; run: () => Promise<void> }[] = []
// Queued or in flight, by local_id: the guard against double-queuing.
const pending = new Set<string>()
let activeUploadCount = 0
// Bumped by cancelQueuedUploads. An upload started under an older draft
// never writes its result into the next draft's photo store.
let generation = 0
// Photos removed from their draft: their upload must not write a result.
const cancelled = new Set<string>()
const idleListeners = new Set<() => void>()

/** True when nothing is queued or in flight. */
export function isQueueIdle(): boolean {
  return pending.size === 0
}

/** Calls `listener` each time an upload ends or is dropped. */
export function onQueueChange(listener: () => void): () => void {
  idleListeners.add(listener)
  return () => idleListeners.delete(listener)
}

function notifyQueueChange(): void {
  idleListeners.forEach((listener) => listener())
}

function startNextUpload(): void {
  if (activeUploadCount >= MAX_CONCURRENT_UPLOADS) return
  const next = queued.shift()
  if (!next) return

  activeUploadCount += 1
  void next.run().finally(() => {
    activeUploadCount -= 1
    pending.delete(next.localId)
    startNextUpload()
    notifyQueueChange()
  })
}

export function uploadNewPhoto(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
  updatePhoto: (localId: string, patch: Partial<SubmissionPhoto>) => void,
): void {
  if (pending.has(photo.local_id)) return
  pending.add(photo.local_id)
  const startedIn = generation
  cancelled.delete(photo.local_id)
  const isCurrent = () =>
    startedIn === generation && !cancelled.has(photo.local_id)
  queued.push({
    localId: photo.local_id,
    run: async () => {
      if (!isCurrent()) return
      let lastProgressAt = 0
      try {
        const { cloud_storage_path, cloud_storage_url } =
          await uploadSubmissionPhoto(photo, uid, submissionId, (percent) => {
            const now = Date.now()
            if (!isCurrent()) return
            if (now - lastProgressAt < PROGRESS_UPDATE_INTERVAL_MS) return
            lastProgressAt = now
            updatePhoto(photo.local_id, { upload_progress: percent })
          })
        if (!isCurrent()) return
        updatePhoto(photo.local_id, {
          uploaded: true,
          upload_progress: 100,
          cloud_storage_path,
          cloud_storage_url,
        })
      } catch (error) {
        console.error('[uploadNewPhoto]', photo.local_id, error)
      }
    },
  })
  startNextUpload()
}

/**
 * Drops one photo's queued upload, or detaches it if in flight, so a
 * removed photo's result never reaches the store.
 */
export function cancelPhotoUpload(localId: string): void {
  cancelled.add(localId)
  const index = queued.findIndex((item) => item.localId === localId)
  if (index >= 0) {
    queued.splice(index, 1)
    pending.delete(localId)
    notifyQueueChange()
  }
}

/**
 * Drops every queued upload and detaches in-flight ones from the store.
 * Called when a draft is torn down, so its uploads stop competing with the
 * next draft and never write into it. An in-flight Storage transfer still
 * finishes; the scheduled sweep removes the orphan object.
 */
export function cancelQueuedUploads(): void {
  generation += 1
  for (const item of queued) pending.delete(item.localId)
  queued.length = 0
  notifyQueueChange()
}
