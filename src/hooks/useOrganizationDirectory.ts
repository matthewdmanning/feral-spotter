import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import {
  Organizations,
  type DirectoryCache,
} from '@/src/lib/organizations/Organizations'
import { organizationRequest } from '@/src/lib/organizations/api'
import { type Catalog } from '@/src/types/Organizations'
import { useOrganizationsFlag } from './useOrganizationsFlag'
import { useAuth } from '@/src/lib/auth/useAuth'

export const organizationsDirectory = new Organizations(() =>
  organizationRequest<Catalog & { cacheRadiusKm: number }>({
    action: 'catalog',
  }),
)

/** Keeps nearby boundaries available offline; never exposes an unfiltered browse list. */
export function useOrganizationDirectory(
  latitude?: number,
  longitude?: number,
) {
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const { user } = useAuth()
  const requestVersion = useRef(0)
  const [cache, setCache] = useState<DirectoryCache | null>(null)
  const [online, setOnline] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const invalidateRequest = useCallback(() => {
    requestVersion.current++
  }, [])
  const refresh = useCallback(async () => {
    if (!enabled || !user || latitude == null || longitude == null) return
    const version = ++requestVersion.current
    setLoading(true)
    try {
      const updated = await organizationsDirectory.refresh(latitude, longitude)
      if (version === requestVersion.current) {
        setCache(updated)
        setRefreshFailed(false)
      }
    } catch {
      if (version === requestVersion.current) setRefreshFailed(true)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [enabled, user, latitude, longitude])
  useEffect(() => {
    let active = true
    void organizationsDirectory.cached().then((value) => {
      if (active)
        setCache((current) =>
          current && (!value || current.fetchedAt >= value.fetchedAt)
            ? current
            : value,
        )
    })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    const update = () => {
      if (active) void refresh()
    }
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected === true && state.isInternetReachable !== false
      if (active) setOnline(connected)
      if (connected) update()
    })
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update()
    })
    return () => {
      active = false
      invalidateRequest()
      unsubscribe()
      subscription.remove()
    }
  }, [refresh, invalidateRequest])
  const organizations = useMemo(
    () => organizationsDirectory.eligible(cache, latitude, longitude),
    [cache, latitude, longitude],
  )
  return {
    cache,
    online,
    loading,
    refreshFailed,
    refresh,
    organizations,
  }
}
