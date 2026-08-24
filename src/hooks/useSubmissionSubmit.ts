/**
 * hooks/useSubmissionSubmit.ts
 * Final "Done" and "Reset" actions for the submission, both called from
 * Submission Details (src/screens/submission/create/index.tsx). handleDone
 * moved here from the Cat Observations screen (#130); handleReset moved
 * here from useCatSubmit (#153) — it wipes the whole submission, so it
 * belongs on the whole-submission screen, not a single cat's form. Neither
 * has a per-cat form to fold in first: every cat is already saved in the
 * store by the time the user reaches Submission Details. The location/time
 * accuracy warning icon stays informational, not a submit gate (ADR-0002/
 * 0003) — the user can submit anyway. Zero cats and zero photos are hard
 * blocks instead (#265 product decision). Photos still uploading in the
 * background are waited out silently (waitForUploads below), not surfaced
 * as a popup — see its comment for why.
 */

import {
  showError,
  usePhotoStore,
  useSubmissionStore,
  useUIStore,
} from '@/src/hooks'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { EVENTS, fireAnalyticsEvent } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { completeDraft, discardDraft } from '@/src/lib/submission/draft'
import {
  finalizeSubmissionPhotoMetadata,
  uploadSubmissionMetadata,
} from '@/src/lib/upload/firebaseUpload'
import type { SubmissionApiPayload, SubmissionPhoto } from '@/src/types'
import { parseExifDateTime } from '@/src/utils/libraryPickTime'
import { validateCatCount, validatePhotos } from '@/src/utils/validation'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

export interface SubmissionSubmitResult {
  handleDone: () => void
  handleReset: () => void
  isSubmitting: boolean
}

// Uploads are fire-and-forget from the moment each photo is captured/picked
// (uploadNewPhoto.ts) — resumable via the Firebase SDK, which already
// retries through spotty connections on its own. A user tapping Submit
// slightly ahead of that background work finishing isn't a decision they
// can act on (there's no "retry" for them to do — the SDK is already
// retrying), so this waits silently instead of nagging with a popup. Only
// a genuine stall — no upload progress landing within the timeout — is
// worth surfacing, via the existing catch block's "Submission Failed" alert.
const UPLOAD_WAIT_TIMEOUT_MS = 30_000
const UPLOAD_WAIT_POLL_MS = 500

async function waitForUploads(): Promise<void> {
  const deadline = Date.now() + UPLOAD_WAIT_TIMEOUT_MS
  while (usePhotoStore.getState().photos.some((p) => !p.uploaded)) {
    if (Date.now() >= deadline) {
      throw new Error(
        'Photo upload is taking longer than expected. Check your connection and try again.',
      )
    }
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_WAIT_POLL_MS))
  }
}

export function useSubmissionSubmit(): SubmissionSubmitResult {
  const cats = useSubmissionStore((s) => s.cats)
  const submission = useSubmissionStore((s) => s.submission)

  const photos = usePhotoStore((s) => s.photos)
  const cloudSubmissionId = usePhotoStore((s) => s.submissionId)

  const { user } = useAuth()

  const setSubmitting = useUIStore((s) => s.setSubmitting)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDone = useCallback(() => {
    const catCount = cats.length
    const photoCount = photos.length

    Alert.alert(
      'Submit Submission',
      `Submit ${catCount} cat${catCount !== 1 ? 's' : ''} and ${photoCount} photo${photoCount !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            // #265: zero cats and zero photos are hard blocks; location/
            // time accuracy stays informational (the warning icon already
            // covers that, and the user can submit through it).
            const requiredErrors = [
              ...validateCatCount(cats.length),
              ...validatePhotos(photos.length),
            ]
            if (requiredErrors.length > 0) {
              showError(
                'Submission Incomplete',
                requiredErrors.map((e) => e.message).join('\n'),
              )
              return
            }

            setIsSubmitting(true)
            setSubmitting(true)

            // A submission that "succeeds" while silently missing photos is
            // exactly the P0 map #31 defines — this still guards against
            // that, just without a popup the user can't act on (see
            // waitForUploads' comment).
            try {
              await waitForUploads()
            } catch (err) {
              showError(
                'Submission Failed',
                err instanceof Error ? err.message : 'Please try again',
              )
              setIsSubmitting(false)
              setSubmitting(false)
              return
            }

            // Re-read from the store rather than trust the `photos` closure
            // above: waitForUploads can resolve with fresher `uploaded`
            // flags than what was captured when this Alert was built.
            const freshPhotos = usePhotoStore.getState().photos

            const cId = await getCurrentCacheId()
            if (cId) {
              // metadata is replaced wholesale on update (no deep merge), so
              // resend the full current snapshot here — not just the fields
              // this submit touches — or fields set after cache creation
              // (e.g. manual_time, filled in after the initial snapshot on
              // an EXIF-less Library pick) get silently dropped.
              await updateSubmissionCache(cId, {
                status: 'Sending',
                cats,
                photo_links: freshPhotos.map((p) => p.uri),
                metadata: {
                  location_method: submission.location_type,
                  time_method: submission.time_type,
                  address: submission.address,
                  manual_time: submission.manual_time,
                  captured_at: submission.captured_at,
                },
              })
              const snap = await getSubmissionCache(cId)
              if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SENDING, snap)
            }

            try {
              const uploadedPhotos = freshPhotos.filter(
                (
                  p,
                ): p is SubmissionPhoto & {
                  cloud_storage_path: string
                  cloud_storage_url: string
                } =>
                  p.uploaded &&
                  p.cloud_storage_path != null &&
                  p.cloud_storage_url != null,
              )
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

              // #264: box geometry lived only in useBoundingBoxStore's local
              // AsyncStorage — never left the device. Fold it in per cat here
              // so it's part of the upload payload.
              // cloud_storage_path is attached per box, not just left to the
              // uploadSubmissionPhoto naming convention (photo_local_id.ext)
              // — a box is worthless downstream without a recoverable link to
              // its image.
              const cloudPathByLocalId = new Map(
                uploadedPhotos.map((p) => [p.local_id, p.cloud_storage_path]),
              )
              const catsWithBoxes = cats.map((cat) => ({
                ...cat,
                boxes: useBoundingBoxStore
                  .getState()
                  .getBoxesForCat(cat.local_id)
                  .map(
                    ({
                      photo_local_id,
                      lowerLeftX,
                      lowerLeftY,
                      upperRightX,
                      upperRightY,
                    }) => ({
                      photo_local_id,
                      cloud_storage_path:
                        cloudPathByLocalId.get(photo_local_id),
                      lowerLeftX,
                      lowerLeftY,
                      upperRightX,
                      upperRightY,
                    }),
                  ),
              }))

              const payload: SubmissionApiPayload = {
                submission,
                cats: catsWithBoxes,
                photo_paths: uploadedPhotos.map((p) => p.cloud_storage_path),
                ...(photoLocations.length > 0 && {
                  photo_locations: photoLocations,
                }),
              }

              if (!user?.uid || !cloudSubmissionId) {
                throw new Error('Missing uid/submissionId for submission')
              }

              // #264 amendment to ADR-0002/ADR-0003: each photo's Storage
              // object must be self-describing — images get exported/consumed
              // separately from metadata.json downstream (ML pipeline), so a
              // fetch back to the submission record can't be assumed.
              const userId = user.uid
              // Prefers each photo's own capture moment over the submission-
              // wide value — submission.captured_at is the *earliest* EXIF
              // time across a multi-select Library pick (ADR-0003's interim
              // MVP rule), which is only correct as a submission-level
              // approximation; stamped per image it would misdate every
              // photo but the earliest one. Camera captures set captured_at
              // at shutter press (no EXIF exists to read); Library picks
              // parse their own exif.timestamp the same way buildSubmissionPhoto
              // does. Only a genuinely timeless photo (parse failure, no
              // EXIF, no manual/captured_at) falls back to Submit time.
              const submitFallbackTime = new Date().toISOString()
              const photoTimeFor = (p: SubmissionPhoto) =>
                p.captured_at ??
                parseExifDateTime(p.exif?.timestamp) ??
                submission.captured_at ??
                submission.manual_time ??
                submitFallbackTime

              // Best-effort: the P0 this app guards hard against is silently
              // missing photos (blocked above), not a metadata patch on an
              // already-fully-uploaded photo — don't fail an otherwise-
              // successful submission over a flaky-network patch failure.
              const finalizeResults = await Promise.allSettled(
                uploadedPhotos.map((p) =>
                  finalizeSubmissionPhotoMetadata(
                    p.cloud_storage_path,
                    userId,
                    photoTimeFor(p),
                    latitude,
                    longitude,
                  ),
                ),
              )
              finalizeResults.forEach((result, i) => {
                if (result.status === 'rejected') {
                  console.error(
                    '[useSubmissionSubmit] finalizeSubmissionPhotoMetadata',
                    uploadedPhotos[i].local_id,
                    result.reason,
                  )
                }
              })

              await uploadSubmissionMetadata(
                payload,
                user.uid,
                cloudSubmissionId,
              )

              // Flips the history row to 'Submitted', releases the current
              // pointer (otherwise every later draft's createSubmissionCache()
              // guard sees a truthy current ID and never creates its own row)
              // and wipes all four draft stores — see lib/submission/draft.ts.
              const snap = await completeDraft()
              if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SUBMITTED, snap)
              // Navigation deliberately stays in the caller: its ordering
              // against the create screen's auto-skip effect is load-bearing
              // (#189 — see src/screens/submission/create/index.tsx).
              router.replace('/')
            } catch (err) {
              if (cId) {
                await updateSubmissionCache(cId, { status: 'Failed' })
                const snap = await getSubmissionCache(cId)
                if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_FAILED, snap)
              }
              showError(
                'Submission Failed',
                err instanceof Error ? err.message : 'Please try again',
              )
            } finally {
              setIsSubmitting(false)
              setSubmitting(false)
            }
          },
        },
      ],
    )
  }, [cats, photos, submission, cloudSubmissionId, user, setSubmitting])

  // ── Reset → confirm → clear all (#153) ─────────────────────────────────────

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Submission',
      'This will permanently clear all cats, photos and submission data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await discardDraft()
            router.replace('/')
          },
        },
      ],
    )
  }, [])

  return { handleDone, handleReset, isSubmitting }
}
