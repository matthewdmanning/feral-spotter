/**
 * hooks/useFeralReports.ts
 * Loads the signed-in user's Sighting history, groups it into map spots,
 * and handles refresh.
 */

import {
  EVENTS,
  fireAnalyticsEvent,
  IS_PRERELEASE,
} from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  getAllSubmissionCaches,
  getSubmissionCache,
  type SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'
import {
  groupReportsBySpot,
  ownReports,
  type ReportSpot,
} from '@/src/lib/reports/history'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface FeralReportsResult {
  caches: SubmissionCacheFile[]
  /** Map pins, newest spot first. Sightings with no location are left out. */
  spots: ReportSpot[]
  refreshing: boolean
  load: () => void
  onRefresh: () => void
}

function fireViewed(all: SubmissionCacheFile[]) {
  if (IS_PRERELEASE && all.length > 0) {
    all.forEach((cache) => fireAnalyticsEvent(EVENTS.REPORTS_VIEWED, cache))
  }
}

export function useFeralReports(): FeralReportsResult {
  const { user } = useAuth()
  const uid = user?.uid
  const [allCaches, setAllCaches] = useState<SubmissionCacheFile[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const all = await getAllSubmissionCaches()
    setAllCaches(all)
    fireViewed(all)
  }, [])

  useEffect(() => {
    getAllSubmissionCaches().then((all) => {
      setAllCaches(all)
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
      getAllSubmissionCaches().then(setAllCaches)
    }, []),
  )

  const caches = useMemo(() => ownReports(allCaches, uid), [allCaches, uid])
  const spots = useMemo(() => groupReportsBySpot(caches), [caches])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return { caches, spots, refreshing, load, onRefresh }
}

export interface ReportResult {
  /** undefined while loading; null when no such Sighting is on this device. */
  report: SubmissionCacheFile | null | undefined
}

/** One Sighting from history, for the read-only detail view. */
export function useReport(id: string | undefined): ReportResult {
  const [loaded, setLoaded] = useState<{
    id: string | undefined
    report: SubmissionCacheFile | null
  }>()
  useEffect(() => {
    let active = true
    ;(id ? getSubmissionCache(id) : Promise.resolve(null)).then((report) => {
      if (active) setLoaded({ id, report })
    })
    return () => {
      active = false
    }
  }, [id])
  return { report: loaded?.id === id ? loaded?.report : undefined }
}
