/**
 * Shared Sightings on a native map: a pin for each precise location and a
 * shaded area for each approximate one. The camera frames them all and only
 * moves when the set of sightings does, so selecting one or a background
 * refresh never snaps a user's pan back. Tiles stay light in both themes.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, View, type LayoutChangeEvent } from 'react-native'
import { AppleMaps, GoogleMaps } from 'expo-maps'
import { useUnistyles } from 'react-native-unistyles'
import { organizationCopy } from '@/src/shared/config/text'
import {
  GOOGLE_MAP_UI_SETTINGS,
  mapViewForSpots,
  type MapSize,
} from '@/src/shared/lib/mapView'
import type { SharedSighting } from '@/src/features/organizations/sharing/hooks/useSharedSightings'
import {
  areaCorners,
  catCountLabel,
  sightingMapPoints,
} from '@/src/features/organizations/sharing/lib/sightings'
import { styles } from './styles'

export function SharedSightingsMap({
  sightings,
  onSelect,
  onTouchActiveChange,
}: {
  sightings: SharedSighting[]
  onSelect: (id: string) => void
  /** True while a finger is on the map — lets a parent pause its scroll. */
  onTouchActiveChange?: (active: boolean) => void
}) {
  const { theme } = useUnistyles()
  const [size, setSize] = useState<MapSize | null>(null)
  // Keyed on values, not identity: a refresh rebuilds equal sightings.
  const pointsKey = JSON.stringify(sightingMapPoints(sightings))
  const view = useMemo(
    () => (size ? mapViewForSpots(JSON.parse(pointsKey), size) : null),
    [pointsKey, size],
  )
  const latitude = view?.coordinates.latitude
  const longitude = view?.coordinates.longitude
  const zoom = view?.zoom
  const cameraPosition = useMemo(
    () =>
      latitude == null || longitude == null
        ? undefined
        : { coordinates: { latitude, longitude }, zoom },
    [latitude, longitude, zoom],
  )
  const markers = useMemo(
    () =>
      sightings.flatMap((s) =>
        s.preciseLocation
          ? [
              {
                id: s.id,
                coordinates: s.preciseLocation,
                title: catCountLabel(s.catCount),
              },
            ]
          : [],
      ),
    [sightings],
  )
  const polygons = useMemo(
    () =>
      sightings
        .filter((s) => !s.preciseLocation)
        .map((s) => ({
          id: s.id,
          coordinates: areaCorners(s.generalLocation),
          color: theme.mapArea.fill,
          lineColor: theme.mapArea.stroke,
          lineWidth: theme.mapArea.strokeWidth,
        })),
    [sightings, theme.mapArea],
  )
  // A gesture cut off by unmount never sends its touch end; the parent's
  // scroll lock must not stay on.
  const touchActiveChange = useRef(onTouchActiveChange)
  useEffect(() => {
    touchActiveChange.current = onTouchActiveChange
  }, [onTouchActiveChange])
  useEffect(() => () => touchActiveChange.current?.(false), [])

  if (!sightings.length || (Platform.OS !== 'ios' && Platform.OS !== 'android'))
    return null
  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    if (width !== size?.width || height !== size?.height)
      setSize({ width, height })
  }
  const onPress = ({ id }: { id?: string }) => {
    if (id) onSelect(id)
  }
  return (
    <View
      style={styles.map}
      accessibilityLabel={organizationCopy.sharedSightings.mapLabel}
      onLayout={handleLayout}
      onTouchStart={() => onTouchActiveChange?.(true)}
      onTouchEnd={() => onTouchActiveChange?.(false)}
      onTouchCancel={() => onTouchActiveChange?.(false)}
    >
      {!cameraPosition ? null : Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.fill}
          colorScheme={AppleMaps.MapColorScheme.LIGHT}
          cameraPosition={cameraPosition}
          markers={markers}
          polygons={polygons}
          onMarkerClick={onPress}
          onPolygonClick={onPress}
        />
      ) : (
        <GoogleMaps.View
          style={styles.fill}
          colorScheme={GoogleMaps.MapColorScheme.LIGHT}
          cameraPosition={cameraPosition}
          uiSettings={GOOGLE_MAP_UI_SETTINGS}
          markers={markers}
          polygons={polygons}
          onMarkerClick={onPress}
          onPolygonClick={onPress}
        />
      )}
    </View>
  )
}
