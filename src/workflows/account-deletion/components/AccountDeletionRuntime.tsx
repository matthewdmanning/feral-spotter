/**
 * workflows/account-deletion/components/AccountDeletionRuntime.tsx
 * Resumes an unfinished account deletion (#433): a lost server answer is
 * reconciled, and a failed device wipe is retried with backoff, on start,
 * on return to the foreground and on a timer. Mounted once by AppProviders.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { usePendingDeletionStore } from '@/src/shared/lib/pendingDeletion'
import { resumePendingDeletion } from '@/src/workflows/account-deletion/lib/accountDeletion'

/** Waits between retries; the last repeats. */
export const DELETION_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000]

export function AccountDeletionRuntime() {
  const queryClient = useQueryClient()
  const authReady = useAuthStore((s) => s.isReady)
  const pending = usePendingDeletionStore((s) => s.pending !== null)

  useEffect(() => {
    if (!authReady || !pending) return
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let active = true

    const tryResume = async () => {
      if (running || !active) return
      running = true
      clearTimeout(timer)
      try {
        const result = await resumePendingDeletion()
        if (result === 'done') {
          queryClient.clear()
          return
        }
      } catch (error) {
        console.warn('[accountDeletion] resume', error)
      } finally {
        running = false
      }
      if (!active) return
      const delay =
        DELETION_RETRY_DELAYS_MS[
          Math.min(attempt, DELETION_RETRY_DELAYS_MS.length - 1)
        ]
      attempt += 1
      timer = setTimeout(() => void tryResume(), delay)
    }

    void tryResume()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tryResume()
    })
    return () => {
      active = false
      clearTimeout(timer)
      subscription.remove()
    }
  }, [authReady, pending, queryClient])

  return null
}
