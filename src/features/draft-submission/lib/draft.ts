/**
 * lib/submission/draft.ts
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
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import {
  clearCurrentCacheId,
  deleteSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
  type SubmissionCacheFile,
} from '@/src/features/draft-submission/lib/submissionCache'
import { stopLocationCapture } from '@/src/core/location/liveFix'
import { authProvider } from '@/src/features/auth/lib'
import { deleteSubmissionUploads } from '@/src/features/draft-submission/lib/upload/firebaseUpload'

/** Wipes the four draft-owned stores and stops the draft-scoped GPS watch. */
function tearDownDraftState(deferFileDeletion = false): void {
  useSubmissionStore.getState().clearDraft()
  usePhotoStore.getState().clearPhotos(deferFileDeletion)
  useBoundingBoxStore.getState().clearAll()
  useActiveCatFlowStore.getState().setActiveCatId(null)
  stopLocationCapture()
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
 */
export async function discardDraft(): Promise<void> {
  const cacheId = await getCurrentCacheId()
  if (cacheId) await deleteSubmissionCache(cacheId)

  const submissionId = usePhotoStore.getState().submissionId
  const uid = authProvider.getCurrentUser()?.uid
  if (submissionId && uid) void deleteSubmissionUploads(uid, submissionId)

  tearDownDraftState()
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
 * A pool saved before `updated_at` existed migrates the current cache row's
 * age. If that row is missing or unreadable, the pool cannot be dated safely
 * and is discarded.
 */
export async function discardUnsurvivingDraft(
  now: number,
  onCaptureReady?: () => void,
): Promise<void> {
  await Promise.all(draftStores.map(whenHydrated))
  const { photos, updated_at } = usePhotoStore.getState()
  let updatedAt = updated_at
  let oldCacheId: string | null = null
  if (photos.length > 0 && updatedAt == null) {
    oldCacheId = await getCurrentCacheId()
    const cache = oldCacheId ? await getSubmissionCache(oldCacheId) : null
    const cacheUpdatedAt = cache ? new Date(cache.updated_at).getTime() : NaN
    if (!Number.isFinite(cacheUpdatedAt)) {
      updatedAt = NaN
    } else {
      updatedAt = cacheUpdatedAt
      usePhotoStore.setState({ updated_at: updatedAt })
    }
  }
  const isStale = updatedAt != null && now - updatedAt > SUBMISSION_STALE_MS
  if (photos.length === 0 || isStale || !Number.isFinite(updatedAt ?? NaN)) {
    if (oldCacheId === null) oldCacheId = await getCurrentCacheId()
    const oldSubmissionId = usePhotoStore.getState().submissionId
    const uid = authProvider.getCurrentUser()?.uid

    tearDownDraftState(true)
    if (oldCacheId) await clearCurrentCacheId()
    onCaptureReady?.()

    if (oldCacheId) await deleteSubmissionCache(oldCacheId)
    if (oldSubmissionId && uid)
      void deleteSubmissionUploads(uid, oldSubmissionId)
    return
  }

  onCaptureReady?.()
}

/**
 * Submit semantics: the history row survives as 'Submitted' and only the
 * current pointer is released. Returns the post-flip snapshot because the
 * caller still fires SUBMISSION_SUBMITTED with it and can no longer fetch it
 * itself once the pointer is gone — so the read has to sit after the status
 * flip and before the clear.
 */
export async function completeDraft(): Promise<SubmissionCacheFile | null> {
  const cacheId = await getCurrentCacheId()
  let snapshot: SubmissionCacheFile | null = null
  if (cacheId) {
    await updateSubmissionCache(cacheId, { status: 'Submitted' })
    snapshot = await getSubmissionCache(cacheId)
    await clearCurrentCacheId()
  }
  tearDownDraftState()
  return snapshot
}
