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

/**
 * The shape both capture backends return: VisionCamera's photo object and the
 * native module's `capture()` result both reduce to this.
 */
export interface CapturedFrame {
  uri: string
  width: number
  height: number
}

/**
 * Builds a SubmissionPhoto from a camera capture. One builder for both
 * backends, so the shared photo contract is stated in exactly one place.
 *
 * `capturedAt` is always the JS shutter stamp taken before the capture call.
 * The native modules used to supply their own value, stamped when processing
 * finished on iOS and absent on Android, which meant the field held a
 * different instant per platform and no consumer could tell which.
 *
 * Zero dimensions are rejected rather than uploaded. CameraX reports a null
 * `resolutionInfo` until the use case attaches, and the previous `?: 0`
 * fallback let that reach Storage as a photo of size 0x0.
 */
export function buildSubmissionPhotoFromCapture(
  frame: CapturedFrame,
  capturedAt: string,
): SubmissionPhoto {
  if (!frame.uri.startsWith('file://')) {
    throw new Error(
      `[buildSubmissionPhotoFromCapture] uri is not a local file: ${frame.uri}`,
    )
  }
  if (!(frame.width > 0) || !(frame.height > 0)) {
    throw new Error(
      `[buildSubmissionPhotoFromCapture] capture reported no dimensions: ${frame.width}x${frame.height}`,
    )
  }

  return {
    local_id: randomUUID(),
    uri: frame.uri,
    uploaded: false,
    upload_progress: 0,
    width: frame.width,
    height: frame.height,
    captured_at: capturedAt,
  }
}
