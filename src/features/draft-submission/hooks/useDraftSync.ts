/**
 * hooks/useDraftSync.ts
 * Background work Submission Details runs for the open draft: make sure it
 * has a cache row, keep the row's cats and photos current for its Reports
 * card, and
 * commit the Live location fix when it resolves.
 */

import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import {
  useSubmissionStore,
  type ObservedCat,
} from '@/src/features/draft-submission/hooks/useSubmissionStore'
import {
  createSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/features/draft-submission/lib/submissionCache'
import { useLocationCapture } from '@/src/core/location/liveFix'
import { buildCacheMetadata, toCachedPhoto } from '@/src/features/draft-submission/lib/payload'
import { toCachedCat } from '@/src/features/draft-submission/lib/profilePhoto'
import type { SubmissionPhoto } from '@/src/shared/types'
import { randomUUID } from 'expo-crypto'
import { useEffect } from 'react'

/**
 * Copy the draft's cats and photos onto its In Progress row. A row already
 * sent is left alone: Submit wrote its final copy, and clearDraft() empties
 * the stores.
 */
async function syncDraftToRow(
  cats: ObservedCat[],
  photos: SubmissionPhoto[],
): Promise<void> {
  const id = await getCurrentCacheId()
  const row = id ? await getSubmissionCache(id) : null
  if (row?.status !== 'In Progress') return
  const { getBoxesForCat } = useBoundingBoxStore.getState()
  await updateSubmissionCache(row.id, {
    cats: cats.map((cat) => toCachedCat(cat, getBoxesForCat(cat.local_id))),
    photos: photos.map(toCachedPhoto),
  })
}

export function useDraftSync(): void {
  const submission = useSubmissionStore((s) => s.submission)
  const cats = useSubmissionStore((s) => s.cats)
  const photos = usePhotoStore((s) => s.photos)
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
    void syncDraftToRow(cats, photos).catch((error) => {
      console.error('[useDraftSync] syncDraftToRow', error)
    })
  }, [cats, photos])

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
