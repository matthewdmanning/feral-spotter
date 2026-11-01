/**
 * hooks/useDraftSync.ts
 * Background work Submission Details runs for the open draft: make sure it
 * has a cache row, keep the row's cats current for its Reports card, and
 * commit the Live location fix when it resolves.
 */

import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import {
  useSubmissionStore,
  type ObservedCat,
} from '@/src/hooks/useSubmissionStore'
import {
  createSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { useLocationCapture } from '@/src/lib/location'
import { buildCacheMetadata } from '@/src/lib/submission/payload'
import { toCachedCat } from '@/src/lib/submission/profilePhoto'
import { randomUUID } from 'expo-crypto'
import { useEffect } from 'react'

/**
 * Copy the draft's cats onto its In Progress row. A row already sent is left
 * alone: Submit wrote its final cats, and clearDraft() empties the store.
 */
async function syncDraftCats(cats: ObservedCat[]): Promise<void> {
  const id = await getCurrentCacheId()
  const row = id ? await getSubmissionCache(id) : null
  if (row?.status !== 'In Progress') return
  const { getBoxesForCat } = useBoundingBoxStore.getState()
  await updateSubmissionCache(row.id, {
    cats: cats.map((cat) => toCachedCat(cat, getBoxesForCat(cat.local_id))),
  })
}

export function useDraftSync(): void {
  const submission = useSubmissionStore((s) => s.submission)
  const cats = useSubmissionStore((s) => s.cats)
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
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reports shows the In Progress card's cat count from the row, so it must
  // not wait for Submit. A new draft has no cats when the row is created
  // above, so a first run that finds no row has nothing to lose.
  useEffect(() => {
    void syncDraftCats(cats).catch((error) => {
      console.error('[useDraftSync] syncDraftCats', error)
    })
  }, [cats])

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
