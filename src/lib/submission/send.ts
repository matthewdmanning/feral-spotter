/**
 * lib/submission/send.ts
 * One send of the current draft: the history row moves to 'Sending', the
 * payload is built from the stores as they are now, each photo's
 * customMetadata is patched, and metadata.json is uploaded. Private to
 * draft.ts's submitDraft(), which owns the lock, the upload wait, the
 * failure mark and the teardown after a successful send.
 */

import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import {
  persistOrganizationSharing,
  useOrganizationSharingStore,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import { EVENTS } from '@/src/shared/analytics/analytics'
import { fireAnalyticsEvent } from '@/src/features/draft-submission/lib/analytics'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  getCurrentCacheId,
  transitionSubmission,
  updateSubmissionCache,
} from '@/src/features/draft-submission/lib/submissionCache'
import { confirmedSharing } from '@/src/lib/organizations/consent'
import {
  buildCacheMetadata,
  buildSubmissionPayload,
  foldBoxesIntoCat,
  resolvePhotoTime,
  toCachedPhoto,
} from '@/src/features/draft-submission/lib/payload'
import {
  resolveProfileBox,
  toCachedCat,
} from '@/src/features/draft-submission/lib/profilePhoto'
import {
  finalizeSubmissionPhotoMetadata,
  uploadSubmissionMetadata,
} from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import {
  buildGrant,
  FALLBACK_ORGANIZATION_NAME,
} from '@/src/lib/organizations/sharing'
import type { SubmissionPhoto } from '@/src/shared/types'

/** The sharing choice submitDraft confirmed, or null when nothing is shared. */
export type ConfirmedSharing = ReturnType<typeof confirmedSharing>

/**
 * Sends the current draft. Every store is read here, after the upload wait,
 * so a cat edited during the wait is sent as edited. `onRow` hands the
 * history row id back before anything can throw, so the caller can mark it
 * Failed.
 */
export async function sendDraft(
  userId: string,
  cloudSubmissionId: string,
  onRow: (cacheId: string) => void,
  sharing: ConfirmedSharing = null,
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
    const snap = await transitionSubmission(cId, 'Sending', {
      cats: cats.map((cat) =>
        toCachedCat(cat, boxesByCat.get(cat.local_id) ?? []),
      ),
      photos: freshPhotos.map(toCachedPhoto),
      user_id: userId,
      submitted_at: new Date().toISOString(),
      metadata: buildCacheMetadata(submission),
    })
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

  if (
    sharing &&
    confirmedSharing(userId)?.draft.confirmedSignature !==
      sharing.draft.confirmedSignature
  ) {
    throw new Error(
      'Sharing choices changed during submission; review and try again',
    )
  }
  const payload = buildSubmissionPayload({
    submission: useOrganizationsFlag.getState().enabled
      ? submission
      : { ...submission, report_injured: undefined },
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
        '[send] finalizeSubmissionPhotoMetadata',
        uploadedPhotos[i].local_id,
        result.reason,
      )
    }
  })

  await uploadSubmissionMetadata(payload, userId, cloudSubmissionId)

  // Uploads yield to editable sharing controls. A withdrawn or changed choice
  // must not grant access, but the uploaded sighting still completed normally.
  let currentSharing: ConfirmedSharing = null
  if (sharing && useAuthStore.getState().user?.uid === userId) {
    try {
      currentSharing = confirmedSharing(userId)
    } catch {
      // Changed settings need fresh consent on the form, never the old grant.
    }
  }
  // The durable outbox survives draft teardown and has its own sync status.
  if (
    sharing &&
    currentSharing?.draft.confirmedSignature ===
      sharing.draft.confirmedSignature
  ) {
    const sharingState = useOrganizationSharingStore.getState()
    const email = useAuthStore.getState().user?.email ?? null
    sharingState.remember(userId, sharing.draft.selectedIds)
    for (const organizationId of sharing.draft.selectedIds) {
      sharingState.enqueue(userId, {
        action: 'grant',
        organizationId,
        organizationName:
          sharing.draft.organizationNames?.[organizationId] ??
          FALLBACK_ORGANIZATION_NAME,
        grant: buildGrant({
          submissionId: cloudSubmissionId,
          organizationId,
          catalogVersion: sharing.draft.catalogVersion,
          epoch: sharing.epochs[organizationId] ?? 0,
          anonymous: sharing.draft.anonymous,
          settings: sharing.settings,
          email,
        }),
      })
    }
    await persistOrganizationSharing()
    void sharingState.sync(userId)
  }
  if (cId) {
    await updateSubmissionCache(cId, {
      cloud_submission_id: cloudSubmissionId,
    })
  }
}
