import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { useOrganizationSharingStore } from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationDirectoryStore } from '@/src/hooks/useOrganizationDirectory'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'

function syncPermissions() {
  const uid = useAuthStore.getState().user?.uid
  if (uid && useOrganizationSharingStore.getState().hydrated)
    void useOrganizationSharingStore.getState().sync(uid)
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
