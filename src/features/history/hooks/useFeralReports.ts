/**
 * features/history/hooks/useFeralReports.ts
 * Loads the signed-in user's Sighting history, orders it, groups it into map
 * spots, and handles refresh.
 */

import { EVENTS, IS_RELEASE_CANDIDATE } from '@/src/shared/analytics/analytics'
import { fireAnalyticsEvent } from '@/src/features/draft-submission/lib/analytics'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  getAllSubmissionCaches,
  getCurrentCacheId,
  type SubmissionCacheFile,
} from '@/src/shared/lib/submissionCache'
import {
  groupSightingsBySpot,
  ownSightings,
  sortBySightingTime,
  type SightingSpot,
} from '@/src/features/history/lib/history'
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
  /** NAV-5: loading, empty and failed must not read the same. */
  status: HistoryStatus
  refreshing: boolean
  load: () => void
  onRefresh: () => void
}

export type HistoryStatus = 'loading' | 'failed' | 'ready'

interface History {
  all: SubmissionCacheFile[]
  resumableId: string | undefined
}

/** `all` arrives newest-created first, the order Home's resume check reads. */
async function readHistory(): Promise<History> {
  const [all, currentId] = await Promise.all([
    getAllSubmissionCaches(),
    getCurrentCacheId(),
  ])
  const latest = all[0]
  return {
    all,
    resumableId: isResumableDraft(latest, Date.now(), currentId)
      ? latest?.id
      : undefined,
  }
}

function fireViewed(all: SubmissionCacheFile[]) {
  if (IS_RELEASE_CANDIDATE && all.length > 0) {
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
  const [status, setStatus] = useState<HistoryStatus>('loading')

  // Reads can overlap (mount, focus, refresh). Only the newest one lands,
  // so a slow earlier read never overwrites a newer history.
  const latestRead = useRef(0)
  const read = useCallback((fire: boolean) => {
    const readId = ++latestRead.current
    return readHistory()
      .then((next) => {
        if (readId !== latestRead.current) return
        setHistory(next)
        setStatus('ready')
        if (fire) fireViewed(next.all)
      })
      .catch((error) => {
        console.error('[useFeralReports] read history', error)
        if (readId === latestRead.current) setStatus('failed')
      })
  }, [])
  const load = useCallback(() => read(true), [read])

  useEffect(() => {
    void read(true)
  }, [read])

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
      void read(false)
    }, [read]),
  )

  const caches = useMemo(
    () => sortBySightingTime(ownSightings(history.all, uid)),
    [history.all, uid],
  )
  const spots = useMemo(() => groupSightingsBySpot(caches), [caches])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return {
    caches,
    spots,
    resumableId: history.resumableId,
    status,
    refreshing,
    load,
    onRefresh,
  }
}
