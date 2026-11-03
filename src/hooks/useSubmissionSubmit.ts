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
 * background are waited out silently (whenUploadsSettled), not surfaced
 * as a popup — see its comment for why.
 *
 * One submit runs at a time: `useUIStore.isSubmitting` is the lock, and the
 * screen disables every draft-changing control while it is set. The send
 * reads every store fresh after the wait, and stops if the draft it started
 * for is gone.
 */

import { effectiveSharingSettings } from '@/src/types/Organizations'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { confirmedSharing } from '@/src/lib/organizations/consent'
import {
  persistOrganizationSharing,
  useOrganizationSharingStore,
} from '@/src/hooks/useOrganizationSharingStore'
import {
  confirmResetSubmission,
  discardDraftAndGoHome,
} from '@/src/hooks/confirmResetSubmission'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { showAlert, showError, useUIStore } from '@/src/hooks/useUIStore'
import { EVENTS, fireAnalyticsEvent } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { completeDraft } from '@/src/lib/submission/draft'
import {
  buildCacheMetadata,
  buildSubmissionPayload,
  foldBoxesIntoCat,
  resolvePhotoTime,
  toCachedPhoto,
} from '@/src/lib/submission/payload'
import {
  resolveProfileBox,
  toCachedCat,
} from '@/src/lib/submission/profilePhoto'
import {
  finalizeSubmissionPhotoMetadata,
  uploadSubmissionMetadata,
} from '@/src/lib/upload/firebaseUpload'
import {
  syncPhotoUploads,
  whenUploadsSettled,
} from '@/src/lib/upload/draftUploads'
import type { SubmissionPhoto } from '@/src/types'
import { validateCatCount, validatePhotos } from '@/src/utils/validation'
import { router } from 'expo-router'
import { useCallback } from 'react'

export interface SubmissionSubmitResult {
  handleDone: () => void
  handleReset: () => void
  /** Clears the draft and returns Home with no confirmation of its own. */
  handleDiscard: () => Promise<void>
  isSubmitting: boolean
}

// Uploads are fire-and-forget from the moment each photo is captured/picked
// (uploadNewPhoto.ts) — resumable via the Firebase SDK, which already
// retries through spotty connections on its own. A user tapping Submit
// slightly ahead of that background work finishing isn't a decision they
// can act on (there's no "retry" for them to do — the SDK is already
// retrying), so this waits silently instead of nagging with a popup. Only
// a genuine stall — no upload progress landing within the timeout — is
// worth surfacing, via the "Photos Still Uploading" alert. A failed upload
// (nothing left uploading, photo still not uploaded) surfaces at once.
const UPLOAD_WAIT_TIMEOUT_MS = 30_000

// #377: both failure paths leave every draft store intact, so both messages
// say so — a user who just lost 30 seconds has no other reason to believe it.
// They read differently because the next action differs: a stalled upload
// needs a better connection, a rejected send only needs a second attempt.
// The underlying error text goes to the console, never to the user.
const UPLOAD_STALLED_MESSAGE =
  'Your photos did not finish uploading. This Submission is saved on this device. Check your connection, then tap Finished! to send it again.'
const SUBMIT_FAILED_MESSAGE =
  'The Submission did not reach the server. It is saved on this device. Tap Finished! to send it again.'

/** #265 hard blocks, read from the stores as they are now. */
function hasRequiredContent(): boolean {
  const requiredErrors = [
    ...validateCatCount(useSubmissionStore.getState().cats.length),
    ...validatePhotos(usePhotoStore.getState().photos.length),
  ]
  if (requiredErrors.length === 0) return true
  showError(
    'Submission Incomplete',
    requiredErrors.map((e) => e.message).join('\n'),
  )
  return false
}

/**
 * Sends the current draft. Every store is read here, after the upload wait,
 * so a cat edited during the wait is sent as edited. `onRow` hands the
 * history row id back before anything can throw, so the caller can mark it
 * Failed.
 */
async function sendDraft(
  userId: string,
  cloudSubmissionId: string,
  onRow: (cacheId: string) => void,
): Promise<void> {
  const freshPhotos = usePhotoStore.getState().photos
  const { cats, submission } = useSubmissionStore.getState()
  // Confirmation order — the Profile Pic fallback is the first box.
  const boxesByCat = new Map(
    cats.map((cat) => [
      cat.local_id,
      useBoundingBoxStore.getState().getBoxesForCat(cat.local_id),
    ]),
  )

  const cId = await getCurrentCacheId()
  if (cId) {
    onRow(cId)
    // metadata is replaced wholesale on update (no deep merge), so resend
    // the full current snapshot here — not just the fields this submit
    // touches — or fields set after cache creation (e.g. manual_time, filled
    // in after the initial snapshot on an EXIF-less Library pick) get
    // silently dropped. The history row must outlive the draft: camera
    // files are deleted at teardown, so it keeps each photo's cloud URL and
    // each cat's resolved Profile Pic crop.
    await updateSubmissionCache(cId, {
      status: 'Sending',
      cats: cats.map((cat) =>
        toCachedCat(cat, boxesByCat.get(cat.local_id) ?? []),
      ),
      photos: freshPhotos.map(toCachedPhoto),
      user_id: userId,
      submitted_at: new Date().toISOString(),
      metadata: buildCacheMetadata(submission),
    })
    const snap = await getSubmissionCache(cId)
    if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SENDING, snap)
  }

  const uploadedPhotos = freshPhotos.filter(
    (
      p,
    ): p is SubmissionPhoto & {
      cloud_storage_path: string
      cloud_storage_url: string
    } =>
      p.uploaded && p.cloud_storage_path != null && p.cloud_storage_url != null,
  )
  // #264: box geometry lived only in useBoundingBoxStore's local
  // AsyncStorage — never left the device. Fold it in per cat here so it's
  // part of the upload payload.
  const cloudPathByLocalId = new Map(
    uploadedPhotos.map((p) => [p.local_id, p.cloud_storage_path]),
  )
  const catsWithBoxes = cats.map((cat) => {
    const boxes = boxesByCat.get(cat.local_id) ?? []
    return foldBoxesIntoCat(
      {
        ...cat,
        profile_photo_local_id: resolveProfileBox(
          boxes,
          cat.profile_photo_local_id,
        )?.photo_local_id,
      },
      boxes,
      cloudPathByLocalId,
    )
  })

  const payload = buildSubmissionPayload({
    submission,
    catsWithBoxes,
    uploadedPhotos,
  })

  // #264 amendment to ADR-0002/ADR-0003: each photo's Storage object must be
  // self-describing — images get exported/consumed separately from
  // metadata.json downstream (ML pipeline), so a fetch back to the
  // submission record can't be assumed.
  // One Submission location, shared by every photo (ADR 0002).
  const { latitude, longitude } = submission
  // ADR-0003's per-photo time fallback chain — see lib/submission/
  // payload.ts's resolvePhotoTime for the why.
  const submitFallbackTime = new Date().toISOString()
  const photoTimeFor = (p: SubmissionPhoto) =>
    resolvePhotoTime(p, submission, submitFallbackTime)

  // Best-effort: the P0 this app guards hard against is silently missing
  // photos (blocked above), not a metadata patch on an already-fully-
  // uploaded photo — don't fail an otherwise-successful submission over a
  // flaky-network patch failure.
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

  await uploadSubmissionMetadata(payload, userId, cloudSubmissionId)

  // Flips the history row to 'Submitted', releases the current pointer
  // (otherwise every later draft's createSubmissionCache() guard sees a
  // truthy current ID and never creates its own row) and wipes all four
  // draft stores — see lib/submission/draft.ts.
  const snap = await completeDraft()
  if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SUBMITTED, snap)
  // Navigation deliberately stays in the caller: its ordering against the
  // create screen's auto-skip effect is load-bearing (#189 — see
  // src/screens/submission/create/index.tsx).
  router.replace('/')
}

async function markFailed(cacheId: string | null): Promise<void> {
  if (!cacheId) return
  try {
    await updateSubmissionCache(cacheId, { status: 'Failed' })
    const snap = await getSubmissionCache(cacheId)
    if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_FAILED, snap)
  } catch (err) {
    console.error('[useSubmissionSubmit] mark failed', err)
  }
}

async function submitCurrentDraft(userId: string | undefined): Promise<void> {
  const { setSubmitting } = useUIStore.getState()
  if (useUIStore.getState().isSubmitting) return
  if (!hasRequiredContent()) return

  // The draft this submit is for. Reset or Discard during the wait clears
  // it (a later capture mints a new one), and the send must not go on.
  const startedFor = usePhotoStore.getState().submissionId
  setSubmitting(true)
  let cacheId: string | null = null
  try {
    // A submission that "succeeds" while silently missing photos is exactly
    // the P0 map #31 defines — this still guards against that, just without
    // a popup the user can't act on (see UPLOAD_WAIT_TIMEOUT_MS).
    syncPhotoUploads()
    const outcome = await whenUploadsSettled(UPLOAD_WAIT_TIMEOUT_MS)
    if (outcome !== 'uploaded') {
      console.error('[useSubmissionSubmit] uploads', outcome)
      showError('Photos Still Uploading', UPLOAD_STALLED_MESSAGE)
      return
    }
    if (usePhotoStore.getState().submissionId !== startedFor) return
    if (!hasRequiredContent()) return
    if (!userId || !startedFor) {
      throw new Error('Missing uid/submissionId for submission')
    }
    await sendDraft(userId, startedFor, (id) => {
      cacheId = id
    })
  } catch (err) {
    await markFailed(cacheId)
    console.error('[useSubmissionSubmit] submit', err)
    showError('Submission Failed', SUBMIT_FAILED_MESSAGE)
  } finally {
    setSubmitting(false)
  }
}

export function useSubmissionSubmit(): SubmissionSubmitResult {
  const catCount = useSubmissionStore((s) => s.cats.length)
  const photoCount = usePhotoStore((s) => s.photos.length)
  const isSubmitting = useUIStore((s) => s.isSubmitting)
  const { user } = useAuth()
  const userId = user?.uid

  const handleDone = useCallback(() => {
    // One submit at a time; the confirm would be a second chance to tap.
    if (useUIStore.getState().isSubmitting) return
    showAlert(
      'Submit Submission',
      `Submit ${catCount} cat${catCount !== 1 ? 's' : ''} and ${photoCount} photo${photoCount !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: () => submitCurrentDraft(userId),
        },
      ],
    )
  }, [catCount, photoCount, userId])

  return {
    handleDone,
    handleReset: confirmResetSubmission,
    handleDiscard: discardDraftAndGoHome,
    isSubmitting,
  }
}
