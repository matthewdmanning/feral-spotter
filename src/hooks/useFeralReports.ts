/**
 * hooks/useFeralReports.ts
 * Loads the signed-in user's Sighting history, orders it, groups it into map
 * spots, and handles refresh.
 */

import { EVENTS, IS_PRERELEASE } from '@/src/shared/analytics/analytics'
import { fireAnalyticsEvent } from '@/src/features/draft-submission/lib/analytics'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  getAllSubmissionCaches,
  type SubmissionCacheFile,
} from '@/src/features/draft-submission/lib/submissionCache'
import {
  groupSightingsBySpot,
  ownSightings,
  sortBySightingTime,
  type SightingSpot,
} from '@/src/lib/sightings/history'
import { isResumableDraft } from '@/src/features/draft-submission/lib/resumable'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface FeralReportsResult {
  /** Newest first by Sighting time — the time each card shows. */
  caches: SubmissionCacheFile[]
  /** Map pins, newest spot first. Sightings with no location are left out. */
  spots: SightingSpot[]
  /** The draft Home's Continue Observation would resume, if any. */
  resumableId: string | undefined
  refreshing: boolean
  load: () => void
  onRefresh: () => void
}

interface History {
  all: SubmissionCacheFile[]
  resumableId: string | undefined
}

/** `all` arrives newest-created first, the order Home's resume check reads. */
function toHistory(all: SubmissionCacheFile[]): History {
  const latest = all[0]
  return {
    all,
    resumableId: isResumableDraft(latest, Date.now()) ? latest?.id : undefined,
  }
}

function fireViewed(all: SubmissionCacheFile[]) {
  if (IS_PRERELEASE && all.length > 0) {
    all.forEach((cache) => fireAnalyticsEvent(EVENTS.REPORTS_VIEWED, cache))
  }
}

export function useFeralReports(): FeralReportsResult {
  const { user } = useAuth()
  const uid = user?.uid
  const [history, setHistory] = useState<History>({
    all: [],
    resumableId: undefined,
  })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const all = await getAllSubmissionCaches()
    setHistory(toHistory(all))
    fireViewed(all)
  }, [])

  useEffect(() => {
    getAllSubmissionCaches().then((all) => {
      setHistory(toHistory(all))
      fireViewed(all)
    })
  }, [])

  // The tab stays mounted, so a Sighting sent since the last visit would
  // not show until a pull-to-refresh. Re-read on every return to the tab —
  // silently: REPORTS_VIEWED stays a mount/refresh event, not per tab visit.
  const focusedOnce = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true
        return
      }
      getAllSubmissionCaches().then((all) => setHistory(toHistory(all)))
    }, []),
  )

  const caches = useMemo(
    () => sortBySightingTime(ownSightings(history.all, uid)),
    [history.all, uid],
  )
  const spots = useMemo(() => groupSightingsBySpot(caches), [caches])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return {
    caches,
    spots,
    resumableId: history.resumableId,
    refreshing,
    load,
    onRefresh,
  }
}
