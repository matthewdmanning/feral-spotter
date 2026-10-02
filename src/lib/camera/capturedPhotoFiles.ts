/**
 * Ownership of a captured photo's local file.
 *
 * Both native backends and VisionCamera write the JPEG into the app's cache
 * directory and hand back a `file://` uri. Nothing deleted it, so the cache
 * grew without bound across sessions and a burst multiplied it per sighting.
 *
 * The file cannot be deleted when its upload finishes: `photo.uri` is what the
 * annotate carousel and the crop bubble render from, so the local copy is
 * needed for the whole review flow. The owner is therefore the photo store's
 * lifecycle — a photo that leaves the store is a file nothing can read again.
 */

import { File, Paths } from 'expo-file-system'

/**
 * Deletes a captured photo's file, but only inside the app's cache directory.
 * A library-picked photo can carry a uri from somewhere else, and deleting a
 * file the app does not own would destroy the user's own photo.
 */
export function deleteCapturedPhotoFile(uri: string): void {
  if (!uri.startsWith(Paths.cache.uri)) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch (error) {
    // A missing or already-deleted file is not a failure worth surfacing: the
    // photo is gone from the store either way.
    console.error('[deleteCapturedPhotoFile]', uri, error)
  }
}
