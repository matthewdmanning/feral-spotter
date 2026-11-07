import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import {
  Organizations,
  type DirectoryCache,
} from '@/src/lib/organizations/Organizations'
import { organizationRequest } from '@/src/lib/organizations/api'
import { type Catalog } from '@/src/types/Organizations'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { useOrganizationsFlag } from './useOrganizationsFlag'
import { useUIStore } from './useUIStore'

export const organizationsDirectory = new Organizations(() =>
  organizationRequest<Catalog & { cacheRadiusKm: number }>({
    action: 'catalog',
  }),
)

interface DirectoryState {
  cache: DirectoryCache | null
  loading: boolean
  refreshFailed: boolean
  /** Restores the saved cache unless a newer one is already loaded. */
  restore: () => Promise<void>
  /** Refreshes around the given point, or the saved cache center when none. */
  refresh: (latitude?: number, longitude?: number) => Promise<void>
}
let latestRefresh = 0

/** The single owner of directory refreshes; the newest request alone may land. */
export const useOrganizationDirectoryStore = create<DirectoryState>(
  (set, get) => ({
    cache: null,
    loading: false,
    refreshFailed: false,
    restore: async () => {
      const saved = await organizationsDirectory.cached()
      const current = get().cache
      if (saved && (!current || saved.fetchedAt > current.fetchedAt))
        set({ cache: saved })
    },
    refresh: async (latitude, longitude) => {
      if (
        !useOrganizationsFlag.getState().enabled ||
        !useAuthStore.getState().user
      )
        return
      const center =
        latitude != null && longitude != null
          ? { latitude, longitude }
          : (get().cache ?? (await organizationsDirectory.cached()))
      if (!center) return
      const request = ++latestRefresh
      set({ loading: true })
      try {
        const cache = await organizationsDirectory.fetch(
          center.latitude,
          center.longitude,
        )
        if (request !== latestRefresh) return
        await organizationsDirectory.save(cache)
        set({ cache, refreshFailed: false })
      } catch {
        if (request === latestRefresh) set({ refreshFailed: true })
      } finally {
        if (request === latestRefresh) set({ loading: false })
      }
    },
  }),
)

/** Keeps nearby boundaries available offline; never exposes an unfiltered browse list. */
export function useOrganizationDirectory(
  latitude?: number,
  longitude?: number,
) {
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const { cache, loading, refreshFailed, restore, refresh } =
    useOrganizationDirectoryStore()
  useEffect(() => {
    void restore()
  }, [restore])
  // Foreground and reconnection refreshes belong to OrganizationsRuntime.
  useEffect(() => {
    if (enabled && uid && latitude != null && longitude != null)
      void refresh(latitude, longitude)
  }, [enabled, uid, latitude, longitude, refresh])
  const organizations = useMemo(
    () => organizationsDirectory.eligible(cache, latitude, longitude),
    [cache, latitude, longitude],
  )
  return {
    cache,
    online,
    loading,
    refreshFailed,
    refresh: () => refresh(latitude, longitude),
    organizations,
  }
}
