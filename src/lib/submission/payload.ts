/**
 * lib/submission/payload.ts
 * Pure data rules for turning a draft into the upload payload and the cache
 * metadata snapshot — tested as data in, data out, no Firebase/alert/
 * navigation. Sits beside draft.ts (which owns teardown, not assembly) per
 * ADR-0006: compatible, not contradictory — this is a read-side module, it
 * never tears anything down.
 *
 * Extracted out of useSubmissionSubmit.ts's handleDone, where these were
 * pure functions of data already in hand but only reachable by running the
 * whole submit flow — architecture review candidate 4 (2026-09-14).
 */
import type { BoundingBox } from '@/src/types/BoundingBox'
import type { SubmissionApiPayload, SubmissionPhoto } from '@/src/types'
import type { CacheMetadata } from '@/src/lib/cache/submissionCache'
import type { SubmissionDraft } from '@/src/hooks/useSubmissionStore'
import { parseExifDateTime } from '@/src/utils/libraryPickTime'

/** The draft's `location_type`/`time_type` become the cache's
 * `location_method`/`time_method` — same fact, different spelling in
 * `CacheMetadata` (see submissionCache.ts). Previously hand-written,
 * verbatim, at both the mount-time cache-create site (create/index.tsx) and
 * the submit-time cache-update site (useSubmissionSubmit.ts). */
export function buildCacheMetadata(submission: SubmissionDraft): CacheMetadata {
  return {
    location_method: submission.location_type,
    time_method: submission.time_type,
    address: submission.address,
    manual_time: submission.manual_time,
    captured_at: submission.captured_at,
  }
}

/** #264: box geometry lived only in useBoundingBoxStore's local AsyncStorage
 * — never left the device. Folds it into the cat's upload-payload shape,
 * attaching each box's own cloud_storage_path (not left to the upload
 * naming convention) so a box is recoverable downstream without its image. */
export function foldBoxesIntoCat(
  cat: Omit<SubmissionApiPayload['cats'][number], 'boxes'>,
  boxes: BoundingBox[],
  cloudPathByLocalId: Map<string, string>,
): SubmissionApiPayload['cats'][number] {
  return {
    ...cat,
    boxes: boxes.map(
      ({
        photo_local_id,
        lowerLeftX,
        lowerLeftY,
        upperRightX,
        upperRightY,
      }) => ({
        photo_local_id,
        cloud_storage_path: cloudPathByLocalId.get(photo_local_id),
        lowerLeftX,
        lowerLeftY,
        upperRightX,
        upperRightY,
      }),
    ),
  }
}

/**
 * ADR-0003's interim MVP rule: prefers each photo's own capture moment over
 * the submission-wide value (submission.captured_at is the *earliest* EXIF
 * time across a multi-select Library pick, correct only as a submission-
 * level approximation). Camera captures set captured_at at shutter press;
 * Library picks parse their own exif.timestamp the same way
 * buildSubmissionPhoto does. Only a genuinely timeless photo (parse
 * failure, no EXIF, no manual/captured_at) falls back to `fallbackTime`.
 */
export function resolvePhotoTime(
  photo: SubmissionPhoto,
  submission: Pick<SubmissionDraft, 'captured_at' | 'manual_time'>,
  fallbackTime: string,
): string {
  return (
    photo.captured_at ??
    parseExifDateTime(photo.exif?.timestamp) ??
    submission.captured_at ??
    submission.manual_time ??
    fallbackTime
  )
}

/**
 * Final upload payload. `submission` is passed through whole rather than
 * picked field-by-field: `manual_time`/`latitude`/`longitude`/`accuracy`
 * are already on the wire today (see SubmissionApiPayload's `submission`
 * type) — this preserves that byte-for-byte rather than silently narrowing
 * it, which would be a wire-format change, not a refactor.
 */
export function buildSubmissionPayload(params: {
  submission: SubmissionDraft
  catsWithBoxes: SubmissionApiPayload['cats']
  uploadedPhotos: (SubmissionPhoto & { cloud_storage_path: string })[]
}): SubmissionApiPayload {
  const { submission, catsWithBoxes, uploadedPhotos } = params
  // One Submission location, shared by every photo (ADR 0002).
  const { latitude, longitude } = submission
  const photoLocations =
    latitude != null && longitude != null
      ? uploadedPhotos.map((p) => ({
          path: p.cloud_storage_path,
          latitude,
          longitude,
        }))
      : []

  return {
    submission,
    cats: catsWithBoxes,
    photo_paths: uploadedPhotos.map((p) => p.cloud_storage_path),
    ...(photoLocations.length > 0 && { photo_locations: photoLocations }),
  }
}
