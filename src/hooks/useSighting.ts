/**
 * hooks/useSighting.ts
 * One Sighting from history, for the read-only detail view.
 */

import {
  getSubmissionCache,
  type SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'
import { useEffect, useState } from 'react'

export interface SightingResult {
  /** undefined while loading; null when no such Sighting is on this device. */
  sighting: SubmissionCacheFile | null | undefined
}

export function useSighting(id: string | undefined): SightingResult {
  const [loaded, setLoaded] = useState<{
    id: string | undefined
    sighting: SubmissionCacheFile | null
  }>()
  useEffect(() => {
    let active = true
    ;(id ? getSubmissionCache(id) : Promise.resolve(null)).then((sighting) => {
      if (active) setLoaded({ id, sighting })
    })
    return () => {
      active = false
    }
  }, [id])
  return { sighting: loaded?.id === id ? loaded?.sighting : undefined }
}
