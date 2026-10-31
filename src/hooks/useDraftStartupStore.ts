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
      useDraftStartupStore.setState({ phase: 'error' })
      throw error
    })
  useDraftStartupStore.setState({ task: initialization })
  return initialization
}
