/**
 * shared/types/Photo.ts
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
  /**
   * 0 … MAX_PHOTOS-1: the photo's object name in its Submission folder
   * (`photo-{slot}`). storage.rules accepts only these names, which is
   * what caps a Submission at MAX_PHOTOS. Set when the photo joins the pool.
   */
  upload_slot?: number
  /**
   * The DNG a RAW+JPEG camera capture wrote beside `uri`, in the app cache.
   * It is uploaded byte-for-byte when present, then deleted with the photo on
   * removal, after a successful send, or when the draft is discarded.
   */
  raw_uri?: string
  /** The stable Storage object path for the paired DNG, once both files upload. */
  raw_cloud_storage_path?: string
  /** Download URL for the paired DNG, once both files upload. */
  raw_cloud_storage_url?: string
  /**
   * The server's reason for refusing this photo's last upload grant, e.g.
   * `quota_exceeded` (LOGIC-5). Cleared when an upload succeeds.
   */
  upload_refusal?: string
  /** How the camera was set for this capture. Camera captures only. */
  camera_config?: PhotoCameraConfig
}

/**
 * The camera settings one capture ran with, by name. Values are strings
 * because they become Storage custom metadata: each entry is written to the
 * photo's object as `camera_<key>` at Submit, beside its location and time,
 * so an exported photo still says how it was taken.
 */
export type PhotoCameraConfig = Readonly<Record<string, string>>
