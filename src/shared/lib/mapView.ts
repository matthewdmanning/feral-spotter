/**
 * shared/lib/mapView.ts
 * Camera framing shared by the app's native maps: a camera that shows a set
 * of points, plus the map chrome every map turns off. Pure, no React.
 */

export interface MapPoint {
  latitude: number
  longitude: number
}

export interface MapView {
  coordinates: MapPoint
  zoom: number
}

export interface MapSize {
  width: number
  height: number
}

/** Google Maps chrome that would cover pins or move the user off the data. */
export const GOOGLE_MAP_UI_SETTINGS = {
  mapToolbarEnabled: false,
  myLocationButtonEnabled: false,
  zoomControlsEnabled: false,
}

const SINGLE_SPOT_ZOOM = 15
const MIN_ZOOM = 3
const MAX_ZOOM = 16
/** Margin around the outermost points, as a fraction of the span. */
const FIT_PADDING = 0.4
/** Web-Mercator: the whole world is one 256-dp tile at zoom 0. */
const TILE_SIZE_DP = 256

const toRad = (deg: number) => (deg * Math.PI) / 180
/** Web-Mercator y, in radians: the world spans 2π. */
const mercatorY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2))
const latitudeOfY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI

/**
 * A camera that shows every point in a map of `size` dp. The world is
 * TILE_SIZE_DP·2^zoom dp wide, so each axis gives the largest zoom at which
 * its span (plus padding) still fits; the smaller one wins. Latitude is
 * measured in Mercator y, so the fit holds at any latitude and any map shape.
 */
export function mapViewForSpots(
  spots: readonly MapPoint[],
  size: MapSize,
): MapView | null {
  if (spots.length === 0) return null
  const ys = spots.map((s) => mercatorY(s.latitude))
  const lngs = spots.map((s) => s.longitude)
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)]
  const coordinates = {
    latitude: latitudeOfY((minY + maxY) / 2),
    longitude: (minLng + maxLng) / 2,
  }
  const lngFraction = ((maxLng - minLng) / 360) * (1 + FIT_PADDING)
  const yFraction = ((maxY - minY) / (2 * Math.PI)) * (1 + FIT_PADDING)
  if (lngFraction === 0 && yFraction === 0) {
    // One point: use it as stored, not round-tripped through Mercator.
    return {
      coordinates: {
        latitude: spots[0].latitude,
        longitude: spots[0].longitude,
      },
      zoom: SINGLE_SPOT_ZOOM,
    }
  }
  const zoomFor = (fraction: number, dp: number) =>
    fraction === 0 ? Infinity : Math.log2(dp / (TILE_SIZE_DP * fraction))
  const zoom = Math.min(
    zoomFor(lngFraction, size.width),
    zoomFor(yFraction, size.height),
  )
  return {
    coordinates,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom))),
  }
}

/** NAV-5: where an empty map opens when the device position is unknown. */
export const FALLBACK_MAP_CENTER: MapPoint = {
  latitude: 29.9753,
  longitude: 31.1376,
}

/** A camera on one point, as a lone pin would get. */
export function mapViewForPoint(point: MapPoint): MapView {
  return { coordinates: point, zoom: SINGLE_SPOT_ZOOM }
}
