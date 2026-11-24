/**
 * shared/types/Api.ts
 * Shapes for the submission-metadata Cloud Storage upload and the local
 * post-submission cache. Field shapes mirror SubmissionDraft/ObservedCat
 * (src/features/draft-submission/hooks/useSubmissionStore) structurally rather than importing them,
 * since types/ must not depend on hooks/.
 */

/** Where a photo's time came from (ADR-0003, 2026-11-24). */
export type PhotoTimeSource = 'capture' | 'exif' | 'manual' | 'unknown'

/** One photo's time. `time` (ISO) is absent only when the source is `unknown`. */
export type PhotoTime =
  | { time_source: Exclude<PhotoTimeSource, 'unknown'>; time: string }
  | { time_source: 'unknown'; time?: undefined }

export interface SubmissionApiPayload {
  submission: {
    report_injured?: boolean
    location_type: string
    time_type: string
    address?: string
    /** ISO — set only for a Library pick with trusted EXIF DateTime (ADR 0003). */
    captured_at?: string
    /** ISO — set when time_type === 'manual'. */
    manual_time?: string
    /** The one Submission-wide GPS fix (ADR 0002) — also carried per-photo
     * in `photo_locations` below; present here too since the whole draft is
     * passed through rather than picked field-by-field. */
    latitude?: number
    longitude?: number
    accuracy?: number | null
  }
  cats: {
    local_id: string
    age: string
    ear_tipped: string
    owned_domesticated: string
    pattern: string
    hair_length: string
    color: string
    sex: string
    health_label: string
    photo_local_ids: string[]
    photos_reviewed: boolean
    /** The photo whose box is the cat's Profile Pic — the user's choice, else the first box's photo. */
    profile_photo_local_id?: string
    /** Box geometry drawn for this cat — normalised 0-1 image-pixel corners (src/shared/types/BoundingBox.ts). */
    boxes: {
      photo_local_id: string
      /** Undefined only if the box's photo somehow isn't among the uploaded set at submit time. */
      cloud_storage_path?: string
      lowerLeftX: number
      lowerLeftY: number
      upperRightX: number
      upperRightY: number
    }[]
  }[]
  photo_paths: string[]
  /** JPEG/DNG pairs. DNGs stay out of photo_paths for existing consumers. */
  photo_pairs?: { jpeg_path: string; dng_path: string }[]
  /** Each photo's own time, keyed by cloud_storage_path (ADR-0003). The
   * only durable copy: Storage metadata carries none. */
  photo_times: ({ path: string } & PhotoTime)[]
  /** GPS fix captured at photo-take time, keyed by cloud_storage_path. Omitted entries have no fix. */
  photo_locations?: { path: string; latitude: number; longitude: number }[]
}

export interface PhotoUploadResponse {
  cloud_storage_path: string
  cloud_storage_url: string
  raw_cloud_storage_path?: string
  raw_cloud_storage_url?: string
}
