/**
 * features/history/lib/history.ts
 * Pure rules for the Reports tab: whose Sightings show, in what order, where
 * each sits on the map, which Sightings share a pin, what a card press does,
 * and what a Profile Pic reads from. Data in, data out — no storage, no React.
 */

import { formatCopy, historyCopy } from '@/src/shared/config/text'
import type {
  CachedCat,
  LocationMethod,
  SubmissionCacheFile,
  TimeMethod,
} from '@/src/shared/lib/submissionCache'
import { sightingPhotoCount } from '@/src/shared/lib/submissionCache'

export interface SpotCoordinates {
  latitude: number
  longitude: number
}

/** One map pin: every Sighting within SPOT_RADIUS_M of the first one in it. */
export interface SightingSpot extends SpotCoordinates {
  /** Stable while the newest Sighting in it stays the same. */
  id: string
  /** Cats across every Sighting at the spot — the pin's badge number. */
  catCount: number
  /** Newest first. A pin press opens sightingIds[0]. */
  sightingIds: string[]
}

/**
 * Sightings closer than this share one pin. Wide enough to merge repeat
 * visits to one colony through GPS scatter; narrow enough to keep two
 * colonies a block apart on separate pins.
 */
export const SPOT_RADIUS_M = 30

/**
 * The badge saturates here; larger counts show as "9+".
 * scripts/generate-cat-pins.py reads this value to draw the pin set.
 */
export const MAX_BADGE_COUNT = 9

const EARTH_RADIUS_M = 6_371_000

const toRad = (deg: number) => (deg * Math.PI) / 180

function distanceM(a: SpotCoordinates, b: SpotCoordinates): number {
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
export function ownSightings(
  caches: SubmissionCacheFile[],
  uid: string | undefined,
): SubmissionCacheFile[] {
  return caches.filter((c) => c.user_id == null || c.user_id === uid)
}

/**
 * The Sighting's own time: a user-set or EXIF time, else when it was sent
 * (ADR 0003), else — for a draft not yet sent — when it was made.
 */
export function sightingTime(cache: SubmissionCacheFile): string {
  return (
    cache.metadata.manual_time ??
    cache.metadata.captured_at ??
    cache.submitted_at ??
    cache.created_at
  )
}

/**
 * The time a Reports card shows: when the last camera photo was taken, else
 * when the report was started. Only camera captures record a capture time.
 */
export function reportCardTime(cache: SubmissionCacheFile): string {
  // ISO strings from toISOString() sort as text in time order.
  const lastShot = cache.photos
    ?.map((p) => p.captured_at)
    .reduce<string | undefined>(
      (last, at) => (at && (!last || at > last) ? at : last),
      undefined,
    )
  return lastShot ?? cache.created_at
}

/** Newest first by the time each card shows, so the list reads in order. */
export function sortBySightingTime(
  caches: SubmissionCacheFile[],
): SubmissionCacheFile[] {
  // An unreadable time sorts last; NaN in a comparator scrambles the order.
  const time = (cache: SubmissionCacheFile) => {
    const ms = Date.parse(reportCardTime(cache))
    return Number.isNaN(ms) ? -Infinity : ms
  }
  return [...caches].sort((a, b) => {
    const diff = time(b) - time(a)
    return Number.isNaN(diff) ? 0 : diff
  })
}

/**
 * What pressing a Reports card does. A sent Sighting opens read-only. An In
 * Progress row resumes only when it is the draft Home would resume
 * (`resumableId`); any other In Progress row is an abandoned draft with
 * nothing to open.
 */
export function sightingCardAction(
  cache: SubmissionCacheFile,
  resumableId: string | undefined,
): 'view' | 'resume' | null {
  if (cache.status !== 'In Progress') return 'view'
  return cache.id === resumableId ? 'resume' : null
}

export function sightingCoordinates(
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
export function groupSightingsBySpot(
  caches: SubmissionCacheFile[],
): SightingSpot[] {
  const spots: SightingSpot[] = []
  for (const cache of sortBySightingTime(caches)) {
    const at = sightingCoordinates(cache)
    if (!at) continue
    const spot = spots.find((s) => distanceM(s, at) <= SPOT_RADIUS_M)
    if (spot) {
      spot.catCount += cache.cats.length
      spot.sightingIds.push(cache.id)
    } else {
      spots.push({
        id: cache.id,
        ...at,
        catCount: cache.cats.length,
        sightingIds: [cache.id],
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

// Plain words for the user, not the app's internal method names.
const { detail } = historyCopy
const LOCATION_SOURCE: Record<LocationMethod, string> = detail.locationSources
const TIME_SOURCE: Record<TimeMethod, string> = detail.timeSources
/** 4 decimals ≈ 11 m: finer than a phone fix, so more digits add noise. */
const COORD_DECIMALS = 4

/**
 * The Sighting's own fields as label/value text, in reading order — the
 * detail view shows answers, never the controls that set them. Time and
 * status are left out: the header shows both.
 */
export function describeSighting(
  cache: SubmissionCacheFile,
): { label: string; value: string }[] {
  const { metadata } = cache
  const at = sightingCoordinates(cache)
  const place =
    metadata.address ??
    (at
      ? formatCopy(detail.coordinates, {
          latitude: at.latitude.toFixed(COORD_DECIMALS),
          longitude: at.longitude.toFixed(COORD_DECIMALS),
        })
      : detail.notRecorded)
  const rows: { label: string; value: string }[] = [
    { label: detail.timeFrom, value: TIME_SOURCE[metadata.time_method] },
    { label: detail.location, value: place },
    {
      label: detail.locationFrom,
      value: LOCATION_SOURCE[metadata.location_method],
    },
  ]
  if (metadata.accuracy != null) {
    rows.push({
      label: detail.gpsAccuracy,
      value: formatCopy(detail.accuracyValue, {
        meters: Math.round(metadata.accuracy),
      }),
    })
  }
  if (metadata.report_injured)
    rows.push({ label: detail.injuredCat, value: detail.yes })
  rows.push(
    { label: detail.photos, value: String(sightingPhotoCount(cache)) },
    { label: detail.cats, value: String(cache.cats.length) },
  )
  return rows
}
