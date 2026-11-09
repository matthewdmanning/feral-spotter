/**
 * features/draft-submission/lib/draft.ts
 *
 * The one owner of Submission draft teardown (#292).
 *
 * A draft is exactly four persisted stores — `submission-store`,
 * `photo-store`, `bounding-box-store` and `active-cat-flow-store`. Every
 * caller used to re-enumerate that list by hand, differently and
 * incompletely each time, which is how `bounding-box-store` ended up never
 * cleared at all and a stale `activeCatId` survived a Reset to reattach the
 * previous draft's boxes to the next one.
 *
 * `submissionCache` is *history*, not draft: it stays outside the boundary
 * and is disposed differently per verb — hard-deleted on discard, flipped to
 * 'Submitted' on complete. `stopLocationCapture()` lives behind the seam
 * because the GPS watch is draft-scoped and is precisely the side effect a
 * third caller forgets; without it `location.ts`'s recheck timer reacquires
 * GPS for the rest of the process lifetime.
 *
 * Plain async functions, not a hook and not a store: every caller already
 * runs inside a callback, and zustand `getState()` works outside React.
 *
 * Deliberately no `startDraft()` — `usePhotoStore` mints its submission id
 * atomically inside its own `set`, and an explicit start would reintroduce
 * the non-atomic window `2357000` fixed. It follows the photo-pool work.
 */

import { SUBMISSION_STALE_MS } from '@/src/shared/config/constants'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import {
  clearCurrentCacheId,
  deleteSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  transitionSubmission,
  type SubmissionCacheFile,
} from '@/src/shared/lib/submissionCache'
import { EVENTS } from '@/src/shared/analytics/analytics'
import { fireAnalyticsEvent } from '@/src/features/draft-submission/lib/analytics'
import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { stopLocationCapture } from '@/src/core/location/liveFix'
import { confirmedSharing } from '@/src/features/organizations/sharing/lib/consent'
import {
  sendDraft,
  type ConfirmedSharing,
} from '@/src/features/draft-submission/lib/send'
import {
  cancelPhotoUploads,
  syncPhotoUploads,
  whenUploadsSettled,
} from '@/src/features/draft-submission/lib/upload/draftUploads'
import { deleteSubmissionUploads } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { missingDraftContent } from '@/src/shared/utils/validation'

// ─── The draft lock ──────────────────────────────────────────────────────────
//
// One submit at a time, and no discard while it runs: clearing the photo
// pool mid-send would send the cats with no photos. The lock lives here,
// next to the only two operations it guards, so no caller can forget it.

let busy = false
const busyListeners = new Set<() => void>()

function setBusy(next: boolean): void {
  busy = next
  busyListeners.forEach((listener) => listener())
}

/** True while a submit is running. */
export function isDraftBusy(): boolean {
  return busy
}

/** For useSyncExternalStore: the UI disables draft controls while busy. */
export function subscribeDraftBusy(listener: () => void): () => void {
  busyListeners.add(listener)
  return () => busyListeners.delete(listener)
}

/**
 * Wipes the four draft-owned stores, stops the draft-scoped GPS watch and
 * drops the draft's queued uploads.
 */
function tearDownDraftState(deferFileDeletion = false): void {
  useSubmissionStore.getState().clearDraft()
  usePhotoStore.getState().clearPhotos(deferFileDeletion)
  useBoundingBoxStore.getState().clearAll()
  useActiveCatFlowStore.getState().setActiveCatId(null)
  stopLocationCapture()
  cancelPhotoUploads()
}

/**
 * Reset semantics: the draft is thrown away, so its history row goes with it.
 * `deleteSubmissionCache` already clears the current pointer when it matches.
 *
 * Also fires the #293 best-effort delete of anything already uploaded for
 * this draft. Photos upload fire-and-forget at capture, so a draft being
 * discarded has usually already put objects in the bucket — and without
 * `metadata.json` they are useless to the project ("no metadata ⇒ no
 * photo"). Read the submission id *before* teardown clears the photo store,
 * and deliberately not awaited: Reset must not block or fail on network
 * I/O. The `sweepPhotosWithoutMetadata` scheduled function is the backstop
 * for every case this misses.
 *
 * Refused while a submit runs; returns whether the draft was discarded.
 */
export async function discardDraft(): Promise<boolean> {
  if (busy) return false
  const cacheId = await getCurrentCacheId()
  if (cacheId) await deleteSubmissionCache(cacheId)

  const submissionId = usePhotoStore.getState().submissionId
  const uid = authProvider.getCurrentUser()?.uid
  if (submissionId && uid) void deleteSubmissionUploads(uid, submissionId)

  tearDownDraftState()
  return true
}

const draftStores = [
  useSubmissionStore,
  usePhotoStore,
  useBoundingBoxStore,
  useActiveCatFlowStore,
]

/** Resolves once a persisted store has read its saved state. */
async function whenHydrated(
  store: (typeof draftStores)[number],
): Promise<void> {
  if (store.persist.hasHydrated()) return
  await store.persist.rehydrate()
  if (!store.persist.hasHydrated()) {
    throw new Error('Could not restore draft state')
  }
}

/**
 * Start-up survival rule (#424): a draft outlives the app process only while
 * it holds a photo and was last changed within SUBMISSION_STALE_MS. Anything
 * else is discarded in full — a draft with no photo has nothing worth keeping,
 * and a stale one would otherwise lock the other photo entrypoint for good.
 *
 * Waits for every draft store to hydrate first: a store that hydrates after
 * the teardown would write its saved state back over the cleared one.
 * A pool without a valid last-change time cannot be dated safely and is discarded.
 */
export async function discardUnsurvivingDraft(
  now: number,
  onCaptureReady?: () => void,
): Promise<void> {
  await Promise.all(draftStores.map(whenHydrated))
  const { photos, updated_at } = usePhotoStore.getState()
  const oldCacheId = await getCurrentCacheId()
  const row = oldCacheId ? await getSubmissionCache(oldCacheId) : null
  // The process died mid-send, so whether it landed is unknown. 'Failed'
  // makes it resumable and tells the user to send it again; a resend
  // overwrites the same objects.
  if (row?.status === 'Sending') await transitionSubmission(row.id, 'Failed')
  // Once a send started, metadata.json may be in the bucket. Its photos and
  // row are the user's sent Sighting, not abandoned draft data.
  const sendStarted = row != null && row.status !== 'In Progress'

  const updatedAt = updated_at
  const isStale = updatedAt != null && now - updatedAt > SUBMISSION_STALE_MS
  if (photos.length === 0 || isStale || !Number.isFinite(updatedAt ?? NaN)) {
    const oldSubmissionId = usePhotoStore.getState().submissionId
    const uid = authProvider.getCurrentUser()?.uid

    tearDownDraftState(true)
    if (oldCacheId) await clearCurrentCacheId()
    onCaptureReady?.()

    if (sendStarted) return
    if (oldCacheId) await deleteSubmissionCache(oldCacheId)
    if (oldSubmissionId && uid)
      void deleteSubmissionUploads(uid, oldSubmissionId)
    return
  }

  onCaptureReady?.()
}

/**
 * Submit semantics: the history row survives as 'Submitted' and only the
 * current pointer is released. Returns the post-flip snapshot, taken before
 * the pointer is cleared, for SUBMISSION_SUBMITTED. Only submitDraft calls
 * it; exported for the teardown invariant test.
 */
export async function completeDraft(): Promise<SubmissionCacheFile | null> {
  const cacheId = await getCurrentCacheId()
  let snapshot: SubmissionCacheFile | null = null
  if (cacheId) {
    snapshot = await transitionSubmission(cacheId, 'Submitted')
    await clearCurrentCacheId()
  }
  tearDownDraftState()
  return snapshot
}

// ─── Submit ──────────────────────────────────────────────────────────────────

/**
 * Background uploads are waited out silently: the Firebase SDK already
 * retries through a spotty connection, so there is nothing for the user to
 * do. Only a stall past this, or an upload that failed outright, is
 * reported.
 */
const UPLOAD_WAIT_TIMEOUT_MS = 30_000

export type SubmitOutcome =
  | { kind: 'sent' }
  | { kind: 'busy' }
  | { kind: 'incomplete'; messages: string[] }
  | { kind: 'sharing-unconfirmed'; message: string }
  | { kind: 'uploads-unfinished' }
  | { kind: 'superseded' }
  | { kind: 'failed' }

/** #265 hard blocks, read from the stores as they are now. */
function missingContent(): string[] {
  return missingDraftContent(
    useSubmissionStore.getState().cats.length,
    usePhotoStore.getState().photos.length,
  )
}

/**
 * Sends the current draft, start to finish, under the draft lock:
 * validate, wait for uploads, send, then flip the row to 'Submitted' and
 * tear the draft down. Every store is read after the wait, so an edit
 * made while waiting is sent. A failure marks the row 'Failed' and keeps
 * every draft store for the retry.
 *
 * Navigation stays with the caller: its ordering against the create
 * screen's auto-skip effect is load-bearing (#189).
 */
export async function submitDraft(): Promise<SubmitOutcome> {
  if (busy) return { kind: 'busy' }
  const missing = missingContent()
  if (missing.length > 0) return { kind: 'incomplete', messages: missing }

  // Organization sharing must be confirmed as it stands now; a changed
  // choice needs the user, so it is reported before the lock is taken.
  let sharing: ConfirmedSharing = null
  const uid = useAuthStore.getState().user?.uid
  try {
    if (uid) sharing = confirmedSharing(uid)
  } catch (error) {
    return {
      kind: 'sharing-unconfirmed',
      message:
        error instanceof Error ? error.message : 'Review sharing choices.',
    }
  }

  // The draft this submit is for. Reset or Discard cannot run while busy,
  // but a teardown from elsewhere mints a new id (or none).
  const startedFor = usePhotoStore.getState().submissionId
  setBusy(true)
  let cacheId: string | null = null
  try {
    syncPhotoUploads()
    const uploads = await whenUploadsSettled(UPLOAD_WAIT_TIMEOUT_MS)
    if (uploads !== 'uploaded') {
      console.error('[draft] uploads', uploads)
      return { kind: 'uploads-unfinished' }
    }
    if (usePhotoStore.getState().submissionId !== startedFor) {
      return { kind: 'superseded' }
    }
    const missingNow = missingContent()
    if (missingNow.length > 0) {
      return { kind: 'incomplete', messages: missingNow }
    }
    const userId = useAuthStore.getState().user?.uid
    if (!userId || !startedFor) {
      throw new Error('Missing uid/submissionId for submission')
    }
    await sendDraft(
      userId,
      startedFor,
      (id) => {
        cacheId = id
      },
      sharing,
    )
    const snapshot = await completeDraft()
    if (snapshot) fireAnalyticsEvent(EVENTS.SUBMISSION_SUBMITTED, snapshot)
    return { kind: 'sent' }
  } catch (error) {
    console.error('[draft] submit', error)
    if (cacheId) {
      try {
        const failed = await transitionSubmission(cacheId, 'Failed')
        if (failed) fireAnalyticsEvent(EVENTS.SUBMISSION_FAILED, failed)
      } catch (markError) {
        console.error('[draft] mark failed', markError)
      }
    }
    return { kind: 'failed' }
  } finally {
    setBusy(false)
  }
}
