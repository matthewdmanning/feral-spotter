/**
 * lib/reports/history.ts
 * Pure rules for the Reports tab: whose Sightings show, where each sits on
 * the map, which Sightings share a pin, and what a Profile Pic reads from.
 * Data in, data out — no storage, no React.
 */

import type {
  CachedCat,
  SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'

export interface SpotCoordinates {
  latitude: number
  longitude: number
}

/** One map pin: every Sighting within SPOT_RADIUS_M of the first one in it. */
export interface ReportSpot extends SpotCoordinates {
  /** Stable while the newest Sighting in it stays the same. */
  id: string
  /** Cats across every Sighting at the spot — the pin's badge number. */
  catCount: number
  /** Newest first. A pin press opens reportIds[0]. */
  reportIds: string[]
}

/**
 * Sightings closer than this share one pin. Wide enough to merge repeat
 * visits to one colony through GPS scatter; narrow enough to keep two
 * colonies a block apart on separate pins.
 */
export const SPOT_RADIUS_M = 30

/** The badge saturates here; larger counts show as "9+". */
export const MAX_BADGE_COUNT = 9

const EARTH_RADIUS_M = 6_371_000

function distanceM(a: SpotCoordinates, b: SpotCoordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * The signed-in user's own history. A row without a uid predates this
 * feature or is a draft not yet sent from this device; it is kept. A row
 * sent by another account on this device is left out.
 */
export function ownReports(
  caches: SubmissionCacheFile[],
  uid: string | undefined,
): SubmissionCacheFile[] {
  return caches.filter((c) => c.user_id == null || c.user_id === uid)
}

export function reportCoordinates(
  cache: SubmissionCacheFile,
): SpotCoordinates | null {
  const { latitude, longitude } = cache.metadata
  if (latitude == null || longitude == null) return null
  return { latitude, longitude }
}

/**
 * Greedy, newest first: each Sighting joins the first spot whose anchor is
 * within SPOT_RADIUS_M, else anchors a new one. Anchoring on one point (not
 * a moving centroid) keeps a chain of nearby Sightings from drifting into
 * one giant pin. Sightings with no location are left off the map.
 */
export function groupReportsBySpot(
  caches: SubmissionCacheFile[],
): ReportSpot[] {
  const newestFirst = [...caches].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )
  const spots: ReportSpot[] = []
  for (const cache of newestFirst) {
    const at = reportCoordinates(cache)
    if (!at) continue
    const spot = spots.find((s) => distanceM(s, at) <= SPOT_RADIUS_M)
    if (spot) {
      spot.catCount += cache.cats.length
      spot.reportIds.push(cache.id)
    } else {
      spots.push({
        id: cache.id,
        ...at,
        catCount: cache.cats.length,
        reportIds: [cache.id],
      })
    }
  }
  return spots
}

/** Which pin icon a spot uses: no badge for one cat, 2…9, then "9+". */
export type PinBadge = 'none' | number | 'many'

export function pinBadge(catCount: number): PinBadge {
  if (catCount <= 1) return 'none'
  if (catCount > MAX_BADGE_COUNT) return 'many'
  return catCount
}

export interface MapView {
  coordinates: SpotCoordinates
  zoom: number
}

const SINGLE_SPOT_ZOOM = 15
const MIN_ZOOM = 3
const MAX_ZOOM = 16
/** Margin around the outermost pins, as a fraction of the span. */
const FIT_PADDING = 0.4

/**
 * A camera that shows every spot. Web-Mercator zoom from the wider of the
 * two spans: one world (360°) fits at zoom 0, and each level halves it.
 * Latitude span is doubled because the Reports map is about half as tall
 * as it is wide. An approximation: it ignores Mercator stretch, which is
 * small at the study area's latitude.
 */
export function mapViewForSpots(spots: SpotCoordinates[]): MapView | null {
  if (spots.length === 0) return null
  const lats = spots.map((s) => s.latitude)
  const lngs = spots.map((s) => s.longitude)
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)]
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)]
  const coordinates = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
  }
  const span = Math.max(maxLng - minLng, (maxLat - minLat) * 2)
  if (span === 0) return { coordinates, zoom: SINGLE_SPOT_ZOOM }
  const zoom = Math.log2(360 / (span * (1 + FIT_PADDING)))
  return {
    coordinates,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom))),
  }
}

/** Where to read a cat's Profile Pic from, after the draft is gone. */
export function profilePicUri(
  cache: SubmissionCacheFile,
  cat: CachedCat,
): string | undefined {
  const photoId = cat.profile_box?.photo_local_id
  if (!photoId) return undefined
  const photo = cache.photos?.find((p) => p.local_id === photoId)
  // The cloud copy outlives the draft; a camera capture's local file does
  // not. A library pick's local file survives, so it is the offline fallback.
  return photo?.cloud_storage_url ?? photo?.uri
}

/** The Sighting's own time: a user-set or EXIF time, else when it was made. */
export function sightingTime(cache: SubmissionCacheFile): string {
  return (
    cache.metadata.manual_time ?? cache.metadata.captured_at ?? cache.created_at
  )
}

const LOCATION_SOURCE: Record<string, string> = {
  device: 'Live fix',
  pin: 'Map pin',
  address: 'Address',
}
const TIME_SOURCE: Record<string, string> = {
  device: 'Device clock',
  manual: 'Set by hand',
  metadata: 'Photo EXIF',
}
const COORD_DECIMALS = 5

/**
 * The Sighting's own fields as label/value text, in reading order — the
 * detail view shows answers, never the controls that set them. Time is
 * left out: the caller formats it.
 */
export function describeSighting(
  cache: SubmissionCacheFile,
): { label: string; value: string }[] {
  const { metadata } = cache
  const at = reportCoordinates(cache)
  const photoCount = cache.photos?.length ?? cache.photo_links?.length ?? 0
  const rows = [
    { label: 'Status', value: cache.status },
    {
      label: 'Time source',
      value: TIME_SOURCE[metadata.time_method] ?? metadata.time_method,
    },
    {
      label: 'Location',
      value: at
        ? `${at.latitude.toFixed(COORD_DECIMALS)}, ${at.longitude.toFixed(COORD_DECIMALS)}`
        : 'Not recorded',
    },
    {
      label: 'Location source',
      value:
        LOCATION_SOURCE[metadata.location_method] ?? metadata.location_method,
    },
  ]
  if (metadata.accuracy != null) {
    rows.push({
      label: 'Accuracy',
      value: `±${Math.round(metadata.accuracy)} m`,
    })
  }
  if (metadata.address) rows.push({ label: 'Address', value: metadata.address })
  rows.push(
    { label: 'Photos', value: String(photoCount) },
    { label: 'Cats', value: String(cache.cats.length) },
  )
  return rows
}
