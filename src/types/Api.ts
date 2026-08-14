/**
 * types/Api.ts
 * Shapes for the submission-metadata Cloud Storage upload and the local
 * post-submission cache. Field shapes mirror SubmissionDraft/ObservedCat
 * (src/hooks/useSubmissionStore) structurally rather than importing them,
 * since types/ must not depend on hooks/.
 */

export interface SubmissionApiPayload {
  submission: {
    location_type: string
    time_type: string
    address?: string
    /** ISO — set only for a Library pick with trusted EXIF DateTime (ADR 0003). */
    captured_at?: string
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
    /** Box geometry drawn for this cat — normalised 0-1 image-pixel corners (src/types/BoundingBox.ts). */
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
  /** GPS fix captured at photo-take time, keyed by cloud_storage_path. Omitted entries have no fix. */
  photo_locations?: { path: string; latitude: number; longitude: number }[]
}

export interface PhotoUploadResponse {
  cloud_storage_path: string
  cloud_storage_url: string
}

export interface ApiError {
  message: string
  code?: string
}

/** A submission persisted to the post-submission cache (utils/cache.ts). */
export interface SubmittedSubmission {
  id: string
  location_type: string
  time_type: string
  address?: string
  cats: SubmissionApiPayload['cats']
  photo_urls: string[]
  created_at: string
  submitted_at: string
  status: string
}
