/**
 * features/history/hooks/useFeralReports.ts
 * Loads the signed-in user's Sighting history, orders it, groups it into map
 * spots, and handles refresh.
 */

import {
  EVENTS,
  captureEvent,
  reportError,
} from '@/src/shared/analytics/analytics'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
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
import { useCallback, useMemo, useRef, useState } from 'react'

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
async function readHistory(uid: string): Promise<History> {
  const [rows, currentId] = await Promise.all([
    getAllSubmissionCaches(),
    getCurrentCacheId(),
  ])
  const all = ownSightings(rows, uid)
  const latest = all[0]
  return {
    all,
    resumableId: isResumableDraft(latest, Date.now(), currentId)
      ? latest?.id
      : undefined,
  }
}

/** One event per view, empty history included: an empty list is friction too. */
function fireViewed(all: SubmissionCacheFile[]) {
  const count = (status: SubmissionCacheFile['status']) =>
    all.filter((cache) => cache.status === status).length
  captureEvent(EVENTS.SIGHTING_HISTORY_VIEWED, {
    sighting_count: all.length,
    in_progress_count: count('In Progress'),
    sending_count: count('Sending'),
    submitted_count: count('Submitted'),
    failed_count: count('Failed'),
  })
}

export function useFeralReports(): FeralReportsResult {
  const uid = useAuthStore((s) => (s.isReady ? s.user?.uid : undefined))
  const [loaded, setLoaded] = useState<{
    uid: string
    status: 'ready' | 'failed'
    history?: History
  }>()
  const current = loaded?.uid === uid ? loaded : undefined
  const history = current?.history
  const [refreshing, setRefreshing] = useState(false)

  // A refresh can overlap a focus read. Only the active account's newest
  // read may update the screen or capture analytics.
  const latestRead = useRef(0)
  const viewPending = useRef(false)
  const read = useCallback(async () => {
    if (!uid) return
    const readId = ++latestRead.current
    try {
      const next = await readHistory(uid)
      if (
        readId !== latestRead.current ||
        useAuthStore.getState().user?.uid !== uid
      )
        return
      setLoaded({ uid, history: next, status: 'ready' })
      if (viewPending.current) {
        viewPending.current = false
        // Legacy rows without a known owner stay local.
        fireViewed(next.all.filter((cache) => cache.user_id === uid))
      }
    } catch (error) {
      if (
        readId !== latestRead.current ||
        useAuthStore.getState().user?.uid !== uid
      )
        return
      reportError('[useFeralReports] read history', error)
      setLoaded((previous) => ({
        uid,
        status: 'failed',
        history: previous?.uid === uid ? previous.history : undefined,
      }))
    }
  }, [uid])

  useFocusEffect(
    useCallback(() => {
      viewPending.current = true
      void read()
      return () => {
        viewPending.current = false
        latestRead.current++
      }
    }, [read]),
  )

  const caches = useMemo(
    () => sortBySightingTime(history?.all ?? []),
    [history],
  )
  const spots = useMemo(() => groupSightingsBySpot(caches), [caches])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await read()
    } finally {
      setRefreshing(false)
    }
  }, [read])

  return {
    caches,
    spots,
    resumableId: history?.resumableId,
    status: current?.status ?? 'loading',
    refreshing,
    load: read,
    onRefresh,
  }
}
