/**
 * hooks/useResumableDraft.ts
 * True while the newest draft can be resumed from Home.
 */

import { getAllSubmissionCaches } from '@/src/lib/cache/submissionCache'
import { isResumableDraft } from '@/src/lib/submission/resumable'
import { useIsFocused } from 'expo-router'
import { useEffect, useState } from 'react'

export function useResumableDraft(): boolean {
  // Re-read on every focus, not once on mount (#314). Home stays mounted
  // while Settings sits on top of it, so a mount-once check went stale the
  // moment anything else changed the draft: Clear Draft deleted the cache row
  // and returned here, but this still offered Continue Observation, which
  // then dead-ended on an empty annotate screen. The same staleness ran the
  // other way too — a draft started and returned from left the entry hidden.
  // Reset only escaped it because its path unmounts Home.
  const isFocused = useIsFocused()
  const [resumable, setResumable] = useState(false)
  useEffect(() => {
    if (!isFocused) return
    let cancelled = false
    getAllSubmissionCaches().then((caches) => {
      if (cancelled) return
      setResumable(isResumableDraft(caches[0], Date.now()))
    })
    // The read is async, so a blur mid-flight would otherwise land a stale
    // answer on a screen the user has already left.
    return () => {
      cancelled = true
    }
  }, [isFocused])
  return resumable
}
