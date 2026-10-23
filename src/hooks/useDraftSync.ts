/**
 * hooks/useDraftSync.ts
 * Background work Submission Details runs for the open draft: make sure it
 * has a cache row, and commit the Live location fix when it resolves.
 */

import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import {
  createSubmissionCache,
  getCurrentCacheId,
} from '@/src/lib/cache/submissionCache'
import { useLocationCapture } from '@/src/lib/location'
import { buildCacheMetadata } from '@/src/lib/submission/payload'
import { randomUUID } from 'expo-crypto'
import { useEffect } from 'react'

export function useDraftSync(): void {
  const submission = useSubmissionStore((s) => s.submission)
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
