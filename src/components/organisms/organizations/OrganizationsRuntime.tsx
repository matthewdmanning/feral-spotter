import { organizationsDirectory } from '@/src/hooks/useOrganizationDirectory'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useAuth } from '@/src/lib/auth/useAuth'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { useOrganizationSharingStore } from '@/src/hooks/useOrganizationSharingStore'

/** Flags run independently of analytics. Existing revocations sync even with the flag off. */
export function OrganizationsRuntime() {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const hydrated = useOrganizationSharingStore((s) => s.hydrated)
  useEffect(() => {
    const refresh = () => {
      void useOrganizationsFlag
        .getState()
        .refresh()
        .then(async () => {
          if (!user || !useOrganizationsFlag.getState().enabled) return
          const cache = await organizationsDirectory.cached()
          if (cache)
            await organizationsDirectory.refresh(
              cache.latitude,
              cache.longitude,
            )
        })
        .catch(() => {
          /* Retain cached coverage until the next online refresh. */
        })
      if (user && hydrated)
        void useOrganizationSharingStore.getState().sync(user.uid)
    }
    refresh()
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) refresh()
    })
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      unsubscribe()
      subscription.remove()
    }
  }, [user, hydrated])
  useEffect(() => {
    if (enabled && user && hydrated)
      void useOrganizationSharingStore.getState().sync(user.uid)
  }, [enabled, user, hydrated])
  return null
}
