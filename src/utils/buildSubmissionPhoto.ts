/**
 * utils/buildSubmissionPhoto.ts
 * Builds a SubmissionPhoto from a picked library asset. Extracted from the
 * now-deleted usePhotoSession.ts so useLibraryPhotoPicker can reuse it.
 */

import type { SubmissionPhoto } from '@/src/types'
import type * as ImagePicker from 'expo-image-picker'
import { randomUUID } from 'expo-crypto'

export function buildSubmissionPhoto(
  asset: ImagePicker.ImagePickerAsset,
): SubmissionPhoto {
  return {
    local_id: randomUUID(),
    uri: asset.uri,
    uploaded: false,
    upload_progress: 0,
    width: asset.width,
    height: asset.height,
    exif: asset.exif
      ? {
          latitude: asset.exif.GPSLatitude,
          longitude: asset.exif.GPSLongitude,
          timestamp: asset.exif.DateTime,
          camera_make: asset.exif.Make,
          camera_model: asset.exif.Model,
        }
      : undefined,
  }
}
