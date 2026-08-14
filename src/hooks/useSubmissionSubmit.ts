/**
 * hooks/useSubmissionSubmit.ts
 * Final "Done" and "Reset" actions for the submission, both called from
 * Submission Details (src/screens/submission/create/index.tsx). handleDone
 * moved here from the Cat Observations screen (#130); handleReset moved
 * here from useCatSubmit (#153) — it wipes the whole submission, so it
 * belongs on the whole-submission screen, not a single cat's form. Neither
 * has a per-cat form to fold in first: every cat is already saved in the
 * store by the time the user reaches Submission Details. handleDone does
 * not itself validate — the warning icon is informational, not a submit
 * gate.
 */

import { usePhotoStore, useSubmissionStore, useUIStore } from '@/src/hooks'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { EVENTS, fireAnalyticsEvent } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  clearCurrentCacheId,
  deleteSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { stopLocationCapture } from '@/src/lib/location'
import {
  finalizeSubmissionPhotoMetadata,
  hashUid,
  uploadSubmissionMetadata,
} from '@/src/lib/upload/firebaseUpload'
import type { SubmissionApiPayload, SubmissionPhoto } from '@/src/types'
import { parseExifDateTime } from '@/src/utils/libraryPickTime'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

export interface SubmissionSubmitResult {
  handleDone: () => void
  handleReset: () => void
  isSubmitting: boolean
}

export function useSubmissionSubmit(): SubmissionSubmitResult {
  const cats = useSubmissionStore((s) => s.cats)
  const submission = useSubmissionStore((s) => s.submission)
  const addToHistory = useSubmissionStore((s) => s.addToHistory)
  const clearDraft = useSubmissionStore((s) => s.clearDraft)

  const photos = usePhotoStore((s) => s.photos)
  const clearPhotos = usePhotoStore((s) => s.clearPhotos)
  const cloudSubmissionId = usePhotoStore((s) => s.submissionId)

  const { user } = useAuth()

  const showError = useUIStore((s) => s.showError)
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
            // A submission that "succeeds" while silently missing photos is
            // exactly the P0 map #31 defines — surface this instead of
            // letting the uploadedPhotos filter below drop them quietly.
            const stillUploading = photos.filter((p) => !p.uploaded)
            if (stillUploading.length > 0) {
              showError(
                'Photos Still Uploading',
                `${stillUploading.length} photo${stillUploading.length !== 1 ? 's are' : ' is'} still uploading. Wait a moment and try again.`,
              )
              return
            }

            setIsSubmitting(true)
            setSubmitting(true)

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
                photo_links: photos.map((p) => p.uri),
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
              const uploadedPhotos = photos.filter(
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
              // so it's shared by both the upload payload and the history entry.
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
              // fetch back to the submission record can't be assumed. Same
              // hashUid() the object path itself is built from (ADR-0005) —
              // still deterministic, so a later "delete my data" request can
              // recompute the same hash from the signed-in user's own uid.
              const userIdHash = await hashUid(user.uid)
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
                    userIdHash,
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

              if (cId) {
                await updateSubmissionCache(cId, { status: 'Submitted' })
                const snap = await getSubmissionCache(cId)
                if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SUBMITTED, snap)
                // Without this, submission_cache_current keeps pointing at
                // this now-Submitted entry forever — every later draft's
                // createSubmissionCache() guard in create/index.tsx sees a
                // truthy current ID and never creates its own cache row.
                await clearCurrentCacheId()
              }
              addToHistory({
                id: cloudSubmissionId,
                ...submission,
                cats: catsWithBoxes,
                photo_urls: uploadedPhotos.map((p) => p.cloud_storage_url),
                created_at: new Date(),
                submitted_at: new Date(),
                status: 'submitted',
              })
              clearDraft()
              clearPhotos()
              stopLocationCapture()
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
  }, [
    cats,
    photos,
    submission,
    cloudSubmissionId,
    user,
    addToHistory,
    clearDraft,
    clearPhotos,
    showError,
    setSubmitting,
  ])

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
            const cId = await getCurrentCacheId()
            if (cId) await deleteSubmissionCache(cId)
            clearDraft()
            clearPhotos()
            stopLocationCapture()
            router.replace('/')
          },
        },
      ],
    )
  }, [clearDraft, clearPhotos])

  return { handleDone, handleReset, isSubmitting }
}
