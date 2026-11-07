import type { Catalog, Organization } from '@/src/types/Organizations'
import {
  covers,
  nearby,
  parseCatalog,
  validLocation,
} from '@/src/types/Organizations'
import { asyncStorage } from '@/src/lib/cache/storage'

export interface DirectoryCache extends Catalog {
  latitude: number
  longitude: number
  radiusKm: number
  fetchedAt: string
}
/** Read-only organization directory; owns geographic filtering and offline persistence. */
export class Organizations {
  private refreshSequence = 0
  constructor(
    private readonly load: () => Promise<Catalog & { cacheRadiusKm?: number }>,
  ) {}

  async cached(): Promise<DirectoryCache | null> {
    try {
      const raw = await asyncStorage.getItem('organizations-directory-v1')
      if (!raw) return null
      const cache = JSON.parse(raw) as DirectoryCache
      parseCatalog(cache)
      if (
        !validLocation(cache.latitude, cache.longitude) ||
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

  async refresh(latitude: number, longitude: number): Promise<DirectoryCache> {
    if (!validLocation(latitude, longitude))
      throw new Error('Invalid cache center')
    const sequence = ++this.refreshSequence
    const response = await this.load()
    const catalog = parseCatalog(response)
    const radiusKm = response.cacheRadiusKm ?? 50
    const cache: DirectoryCache = {
      ...catalog,
      organizations: catalog.organizations.filter(
        (org) => org.active && nearby(org, latitude, longitude, radiusKm),
      ),
      latitude,
      longitude,
      radiusKm,
      fetchedAt: new Date().toISOString(),
    }
    if (sequence === this.refreshSequence)
      await asyncStorage.setItem(
        'organizations-directory-v1',
        JSON.stringify(cache),
      )
    return cache
  }

  eligible(
    catalog: Catalog | null,
    latitude?: number,
    longitude?: number,
  ): Organization[] {
    if (!catalog || latitude == null || longitude == null) return []
    return catalog.organizations
      .filter((org) => org.active && covers(org.coverage, latitude, longitude))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}
