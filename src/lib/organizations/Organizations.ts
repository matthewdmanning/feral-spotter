import type { Catalog, Organization } from '@/src/types/Organizations'
import {
  covers,
  DEFAULT_CACHE_RADIUS_KM,
  nearby,
  parseCatalog,
  validLocation,
} from '@/src/types/Organizations'
import { asyncStorage } from '@/src/shared/lib/storage'

export interface DirectoryCache extends Catalog {
  latitude: number
  longitude: number
  radiusKm: number
  fetchedAt: string
}
const CACHE_KEY = 'organizations-directory-v1'

/** Read-only organization directory; owns geographic filtering and offline persistence. */
export class Organizations {
  constructor(
    private readonly load: () => Promise<Catalog & { cacheRadiusKm?: number }>,
  ) {}

  async cached(): Promise<DirectoryCache | null> {
    try {
      const raw = await asyncStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const cache = JSON.parse(raw) as DirectoryCache
      parseCatalog(cache)
      if (
        !validLocation(cache) ||
        !Number.isFinite(cache.radiusKm) ||
        cache.radiusKm <= 0 ||
        !Number.isFinite(Date.parse(cache.fetchedAt))
      )
        return null
      return cache
    } catch {
      return null
    }
  }

  /** Fetches the catalog and keeps active coverage near the center. Does not persist. */
  async fetch(latitude: number, longitude: number): Promise<DirectoryCache> {
    if (!validLocation({ latitude, longitude }))
      throw new Error('Invalid cache center')
    const response = await this.load()
    const catalog = parseCatalog(response)
    const radiusKm = response.cacheRadiusKm ?? DEFAULT_CACHE_RADIUS_KM
    return {
      ...catalog,
      organizations: catalog.organizations.filter(
        (org) => org.active && nearby(org, latitude, longitude, radiusKm),
      ),
      latitude,
      longitude,
      radiusKm,
      fetchedAt: new Date().toISOString(),
    }
  }

  async save(cache: DirectoryCache): Promise<void> {
    await asyncStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  }

  /** The cache holds active organizations only, so containment is the whole test. */
  eligible(
    catalog: Catalog | null,
    latitude?: number,
    longitude?: number,
  ): Organization[] {
    if (!catalog || latitude == null || longitude == null) return []
    return catalog.organizations
      .filter((org) => covers(org.coverage, latitude, longitude))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}
