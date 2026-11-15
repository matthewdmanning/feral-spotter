import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import {
  APPROXIMATE_AREA_FRACTION_DIGITS,
  PRECISE_LOCATION_FRACTION_DIGITS,
} from '@/src/shared/config/constants'
import type { MapPoint } from '@/src/shared/lib/mapView'
import type { SharedSighting } from '@/src/shared/types/Organizations'

const copy = organizationCopy.sharedSightings

export function catCountLabel(count: number): string {
  return count === 1
    ? copy.catCount.one
    : formatCopy(copy.catCount.other, { count })
}

const number = (digits: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits })

/** The shared location in words: precise coordinates or the area's bounds. */
export function sightingLocationLabel(sighting: SharedSighting): string {
  if (sighting.preciseLocation) {
    const format = number(PRECISE_LOCATION_FRACTION_DIGITS).format
    return formatCopy(copy.preciseValue, {
      latitude: format(sighting.preciseLocation.latitude),
      longitude: format(sighting.preciseLocation.longitude),
    })
  }
  const format = number(APPROXIMATE_AREA_FRACTION_DIGITS).format
  const { south, north, west, east } = sighting.generalLocation
  return formatCopy(copy.areaValue, {
    south: format(south),
    north: format(north),
    west: format(west),
    east: format(east),
  })
}

/** Corners of an approximate area, in drawing order. */
export function areaCorners(
  area: SharedSighting['generalLocation'],
): MapPoint[] {
  const { north, south, east, west } = area
  return [
    { latitude: south, longitude: west },
    { latitude: north, longitude: west },
    { latitude: north, longitude: east },
    { latitude: south, longitude: east },
  ]
}

/** Every point the map must keep in view: pins, and each area's corners. */
export function sightingMapPoints(sightings: readonly SharedSighting[]) {
  return sightings.flatMap((s) =>
    s.preciseLocation ? [s.preciseLocation] : areaCorners(s.generalLocation),
  )
}
