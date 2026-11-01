import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { syncEmailSubscription } from '@/src/features/permissions/communications/lib/syncEmailSubscription'

/**
 * Record the choice locally, then sync it to the mailing list. A failed sync
 * is logged, not shown: the choice never blocks the app.
 * ponytail: no retry queue — a failed sync is not retried until the user
 * changes the choice again; add one if drift shows up.
 */
export function saveEmailOptIn(enabled: boolean): void {
  useConsentStore.getState().setEmailOptIn(enabled)
  syncEmailSubscription(enabled).catch((err) =>
    console.error('[email] subscription sync failed:', err),
  )
}
