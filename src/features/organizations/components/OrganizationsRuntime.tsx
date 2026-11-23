import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationDirectoryStore } from '@/src/features/organizations/hooks/useOrganizationDirectory'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'

/** Off, it syncs only to deliver pending items such as revocations. */
function syncPermissions() {
  const uid = useAuthStore.getState().user?.uid
  const sharing = useOrganizationSharingStore.getState()
  if (!uid || !sharing.hydrated) return
  if (
    useOrganizationsFlag.getState().enabled ||
    (sharing.accounts[uid]?.outbox.length ?? 0) > 0
  )
    void sharing.sync(uid)
}
/** Flag, then directory around the open draft's location (or the saved center), then permissions. */
async function refreshAll() {
  await useOrganizationsFlag.getState().refresh()
  const { latitude, longitude } = useSubmissionStore.getState().submission
  await useOrganizationDirectoryStore.getState().refresh(latitude, longitude)
  syncPermissions()
}

/**
 * The one owner of foreground and reconnection refreshes. Flags run
 * independently of analytics. Existing revocations sync even with the flag off.
 */
export function OrganizationsRuntime() {
  const online = useUIStore((s) => s.isOnline)
  const uid = useAuthStore((s) => s.user?.uid)
  const hydrated = useOrganizationSharingStore((s) => s.hydrated)
  const enabled = useOrganizationsFlag((s) => s.enabled)
  // Consent decides whether PostHog may be asked, so a change re-evaluates.
  const analyticsAccepted = useConsentStore((s) => s.analyticsAccepted)
  const consentAccepted = useConsentStore((s) => s.accepted)
  useEffect(() => {
    void useOrganizationsFlag.getState().refresh()
  }, [analyticsAccepted, consentAccepted])
  useEffect(() => {
    if (!online) return
    void refreshAll()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAll()
    })
    return () => subscription.remove()
  }, [online])
  // Sign-in, restored storage and a flag change can each release pending items.
  useEffect(() => syncPermissions(), [uid, hydrated, enabled])
  return null
}
