/**
 * types/Api.ts
 * Shapes for the Cloud Run submission API and the local post-submission cache.
 * Field shapes mirror SubmissionDraft/ObservedCat (src/hooks/useSubmissionStore)
 * structurally rather than importing them, since types/ must not depend on hooks/.
 */

export interface SubmissionApiPayload {
  submission: {
    location_type: string;
    time_type: string;
    address?: string;
  };
  cats: Array<{
    local_id: string;
    age: string;
    ear_tipped: string;
    owned_domesticated: string;
    pattern: string;
    hair_length: string;
    color: string;
    sex: string;
    health: number;
    photo_local_ids: string[];
    photos_reviewed: boolean;
  }>;
  photo_paths: string[];
}

export interface SubmissionApiResponse {
  status: "success" | "error";
  id: string;
  message?: string;
}

export interface PhotoUploadResponse {
  cloud_storage_path: string;
  cloud_storage_url: string;
}

export interface ApiError {
  message: string;
  code?: string;
}

/** A submission persisted to the post-submission cache (utils/cache.ts). */
export interface SubmittedSubmission {
  id: string;
  location_type: string;
  time_type: string;
  address?: string;
  cats: SubmissionApiPayload["cats"];
  photo_urls: string[];
  created_at: string;
  submitted_at: string;
  status: string;
}
