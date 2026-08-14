/**
 * types/Photo.ts
 * A photo attached to the in-progress submission, from camera capture
 * or the device library.
 */

export interface PhotoExif {
  latitude?: number
  longitude?: number
  timestamp?: string
  camera_make?: string
  camera_model?: string
}

export interface SubmissionPhoto {
  local_id: string
  uri: string
  uploaded: boolean
  upload_progress: number
  width: number
  height: number
  exif?: PhotoExif
  cloud_storage_path?: string
  cloud_storage_url?: string
  /** ISO — set at shutter press for a camera capture (no EXIF to read it from). */
  captured_at?: string
}
