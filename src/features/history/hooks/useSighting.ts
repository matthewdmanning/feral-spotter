/**
 * features/history/hooks/useSighting.ts
 * One Sighting from history, for the read-only detail view.
 */

import { reportError } from '@/src/shared/analytics/analytics'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  getSubmissionCache,
  type SubmissionCacheFile,
} from '@/src/shared/lib/submissionCache'
import { useEffect, useState } from 'react'

export interface SightingResult {
  /** undefined while loading; null when no such Sighting is on this device. */
  sighting: SubmissionCacheFile | null | undefined
}

export function useSighting(id: string | undefined): SightingResult {
  const uid = useAuthStore((s) => (s.isReady ? s.user?.uid : undefined))
  const [loaded, setLoaded] = useState<{
    id: string | undefined
    uid: string
    sighting: SubmissionCacheFile | null
  }>()
  useEffect(() => {
    if (!id || !uid) return
    let active = true
    void getSubmissionCache(id)
      .then((sighting) => {
        if (!active || useAuthStore.getState().user?.uid !== uid) return
        const visible = sighting?.user_id == null || sighting.user_id === uid
        setLoaded({ id, uid, sighting: visible ? sighting : null })
      })
      // A failed read shows "not found" rather than loading forever.
      .catch((error) => {
        if (!active || useAuthStore.getState().user?.uid !== uid) return
        reportError('[useSighting]', error)
        setLoaded({ id, uid, sighting: null })
      })
    return () => {
      active = false
    }
  }, [id, uid])
  if (!id || !uid) return { sighting: null }
  return {
    sighting:
      loaded?.id === id && loaded.uid === uid ? loaded.sighting : undefined,
  }
}
