/**
 * Ownership of a captured photo's local file.
 *
 * Both native backends and VisionCamera write the JPEG into the app's cache
 * directory and hand back a `file://` uri. Nothing deleted it, so the cache
 * grew without bound across sessions and a burst multiplied it per sighting.
 *
 * The file cannot be deleted when its upload finishes: `photo.uri` is what the
 * annotate carousel and the crop bubble render from, so the local copy is
 * needed for the whole review flow. Gallery saves add a temporary hold so a
 * photo removed during an active save is deleted only after that save ends.
 */

import { File, Paths } from 'expo-file-system'

interface RetainedFile {
  holds: number
  deleteRequested: boolean
}

const retainedFiles = new Map<string, RetainedFile>()

/** Use this function to recognize cache files owned by the camera workflow. */
function isCapturedPhotoFile(uri: string): boolean {
  return uri.startsWith(Paths.cache.uri)
}

/** Use this function to delete an owned cache file after retention ends. */
function deleteFile(uri: string): void {
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch (error) {
    // A missing or already-deleted file is not a failure worth surfacing: the
    // photo is gone from the store either way.
    console.error('[deleteCapturedPhotoFile]', uri, error)
  }
}

/**
 * Use this function to hold a captured file while an asynchronous gallery save
 * may still read it.
 */
export function retainCapturedPhotoFile(uri: string): void {
  if (!isCapturedPhotoFile(uri)) return
  const retained = retainedFiles.get(uri)
  if (retained) {
    retained.holds += 1
  } else {
    retainedFiles.set(uri, { holds: 1, deleteRequested: false })
  }
}

/**
 * Use this function to release a gallery-save hold and finish deferred cleanup
 * when needed.
 */
export function releaseCapturedPhotoFile(uri: string): void {
  const retained = retainedFiles.get(uri)
  if (!retained) return
  retained.holds -= 1
  if (retained.holds > 0) return
  retainedFiles.delete(uri)
  if (retained.deleteRequested) deleteFile(uri)
}

/**
 * Deletes a captured photo's file, but only inside the app's cache directory.
 * A library-picked photo can carry a uri from somewhere else, and deleting a
 * file the app does not own would destroy the user's own photo.
 */
export function deleteCapturedPhotoFile(uri: string): void {
  if (!isCapturedPhotoFile(uri)) return
  const retained = retainedFiles.get(uri)
  if (retained) {
    retained.deleteRequested = true
    return
  }
  deleteFile(uri)
}
