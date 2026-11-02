/**
 * hooks/useDraftStartupStore.ts
 * Process-local readiness of the draft restore and start-up cleanup.
 */

import { discardUnsurvivingDraft } from '@/src/lib/submission/draft'
import { create } from 'zustand'

interface DraftStartupState {
  phase: 'restoring' | 'cleaning' | 'ready' | 'error'
  task: Promise<void> | null
}

// Process-local: readiness must never survive an app restart.
export const useDraftStartupStore = create<DraftStartupState>(() => ({
  phase: 'restoring',
  task: null,
}))

/** Use this function to share startup restoration and cleanup before draft actions; it coordinates the draft boundary and the process-local readiness store. */
export function initializeDraft(): Promise<void> {
  const { task } = useDraftStartupStore.getState()
  if (task) return task
  const initialization = Promise.resolve()
    .then(() =>
      discardUnsurvivingDraft(Date.now(), () => {
        useDraftStartupStore.setState({ phase: 'cleaning' })
      }),
    )
    .then(() => {
      useDraftStartupStore.setState({ phase: 'ready' })
    })
    .catch((error: unknown) => {
      // Drop the cached task so the next draft action retries: one
      // transient storage failure must not disable the draft until restart.
      useDraftStartupStore.setState({ phase: 'error', task: null })
      throw error
    })
  // A retry after a failure shows as restoring again while it runs.
  useDraftStartupStore.setState((s) => ({
    task: initialization,
    phase: s.phase === 'error' ? 'restoring' : s.phase,
  }))
  return initialization
}
