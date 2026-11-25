/**
 * shared/lib/pendingDeletion.ts
 * An account deletion that has not finished (#433). Written before the
 * server is asked, so a lost response or a failed device wipe is resumed
 * instead of forgotten.
 *
 * - `requested`: the server may or may not have deleted the account.
 * - `deleted`: the server confirmed; this device has not finished forgetting.
 *
 * Its own MMKV instance: the device wipe clears the app's main store and
 * AsyncStorage, and must not clear the record of its own progress.
 * Analytics stays off while one exists (shared/analytics/analytics.ts).
 */

import { createMMKV } from 'react-native-mmkv'
import { create } from 'zustand'

export interface PendingDeletion {
  uid: string
  deleteSightings: boolean
  phase: 'requested' | 'deleted'
}

const KEY = 'pending-account-deletion'
const storage = createMMKV({ id: 'feralspotter-account-deletion' })

function read(): PendingDeletion | null {
  const raw = storage.getString(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingDeletion
  } catch {
    return null
  }
}

/** Reactive view of the marker; written only through the functions below. */
export const usePendingDeletionStore = create<{
  pending: PendingDeletion | null
}>(() => ({ pending: read() }))

export function getPendingDeletion(): PendingDeletion | null {
  return usePendingDeletionStore.getState().pending
}

export function setPendingDeletion(pending: PendingDeletion | null): void {
  if (pending) storage.set(KEY, JSON.stringify(pending))
  else storage.remove(KEY)
  usePendingDeletionStore.setState({ pending })
}
