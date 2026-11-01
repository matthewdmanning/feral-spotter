/**
 * hooks/useDraftSync.ts
 * Background work Submission Details runs for the open draft: make sure it
 * has a cache row, keep the row's cats and photos current for its Reports
 * card, re-queue photos left un-uploaded, and commit the Live location fix
 * when it resolves.
 */

import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import {
  useSubmissionStore,
  type ObservedCat,
} from '@/src/hooks/useSubmissionStore'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  createSubmissionCache,
  getCurrentCacheId,
  UNSENT_STATUSES,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { useLocationCapture } from '@/src/lib/location'
import { syncPhotoUploads } from '@/src/lib/upload/draftUploads'
import { buildCacheMetadata, toCachedPhoto } from '@/src/lib/submission/payload'
import { toCachedCat } from '@/src/lib/submission/profilePhoto'
import type { SubmissionPhoto } from '@/src/shared/types'
import { randomUUID } from 'expo-crypto'
import { useEffect } from 'react'

/**
 * Copy the draft's cats and photos onto its unsent row ('In Progress', or
 * 'Failed' after a send that did not land). A row being sent or already sent
 * is left alone: Submit wrote its final copy, and clearDraft() empties the
 * stores. The status check runs inside the cache's write chain, so it cannot
 * race Submit's own status writes.
 */
async function syncDraftToRow(
  cats: ObservedCat[],
  photos: SubmissionPhoto[],
): Promise<void> {
  const id = await getCurrentCacheId()
  if (!id) return
  const { getBoxesForCat } = useBoundingBoxStore.getState()
  await updateSubmissionCache(
    id,
    {
      cats: cats.map((cat) => toCachedCat(cat, getBoxesForCat(cat.local_id))),
      photos: photos.map(toCachedPhoto),
    },
    UNSENT_STATUSES,
  )
}

/**
 * What the row copies of the photo pool. Upload progress is left out: it
 * changes every 250ms per uploading photo and the row does not store it.
 */
function photoRowSignature(photos: SubmissionPhoto[]): string {
  return JSON.stringify(photos.map(toCachedPhoto))
}

export function useDraftSync(): void {
  const submission = useSubmissionStore((s) => s.submission)
  const cats = useSubmissionStore((s) => s.cats)
  const photoSignature = usePhotoStore((s) => photoRowSignature(s.photos))
  const { user } = useAuth()
  const uid = user?.uid
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )
  const capture = useLocationCapture()

  // Mount-once (#224 follow-up): this only needs to ensure a cache row
  // exists for the current draft, not react to every field edit. Depending
  // on submission.* fields here made it re-run when handleDone's
  // clearDraft() reset them to defaults mid-navigation (post-Submit,
  // before this screen unmounts) — current was just cleared by
  // clearCurrentCacheId(), so getCurrentCacheId() came back null and this
  // created a stray empty cache row for the already-submitted draft.
  useEffect(() => {
    ;(async () => {
      if (!(await getCurrentCacheId())) {
        await createSubmissionCache(
          randomUUID(),
          buildCacheMetadata(submission),
        )
        // The sync below ran before this row existed; the photos are
        // already in the draft, so copy them now.
        await syncDraftToRow(
          useSubmissionStore.getState().cats,
          usePhotoStore.getState().photos,
        )
      }
    })().catch((error) => {
      console.error('[useDraftSync] create row', error)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The In Progress card reads its cat count and photo time from the row,
  // so the row must not wait for Submit.
  useEffect(() => {
    void syncDraftToRow(cats, usePhotoStore.getState().photos).catch(
      (error) => {
        console.error('[useDraftSync] syncDraftToRow', error)
      },
    )
  }, [cats, photoSignature])

  // A photo whose upload failed, or a draft restored after the app was
  // killed mid-upload, has nothing uploading it. Re-queue on open so Submit
  // is not left waiting on an upload that never runs.
  // Keyed on uid: a sign-in that lands after mount still starts them.
  useEffect(() => {
    if (uid) syncPhotoUploads()
  }, [uid])

  // Commit the background Live fix into the Submission draft only once it
  // resolves — never mid-watch, so a reacquire's early (worse) candidates
  // can't clobber the already-stored fix while it's re-settling. Also never
  // overwrite a location the user set by hand via the map picker
  // (location_type === 'pin').
  useEffect(() => {
    if (submission.location_type === 'pin') return
    if (capture.status === 'resolved' && capture.result) {
      setSubmissionLocation(capture.result)
    }
  }, [
    capture.status,
    capture.result,
    submission.location_type,
    setSubmissionLocation,
  ])
}
