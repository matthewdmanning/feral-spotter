/**
 * components/organisms/SightingsMap.tsx
 * Map overview at the top of the Reports tab: one cat-head pin per spot the
 * user has reported from. A spot with more than one cat carries the count in
 * a badge at the icon's bottom right (9+ past nine). Pressing a pin opens
 * the newest Sighting at that spot.
 *
 * Android draws baked bitmaps (scripts/generate-cat-pins.py) — Google Maps
 * markers take an image, not a view, so the badge is part of the bitmap.
 * Apple Maps markers take no custom image: iOS shows an SF Symbol cat for one
 * cat and the count as the marker's monogram for more (iOS 17+).
 *
 * Tiles stay light in both app themes: the pin colours are chosen against
 * light tiles.
 */

import catPin from '@/assets/images/catPins/cat-pin.png'
import catPin2 from '@/assets/images/catPins/cat-pin-2.png'
import catPin3 from '@/assets/images/catPins/cat-pin-3.png'
import catPin4 from '@/assets/images/catPins/cat-pin-4.png'
import catPin5 from '@/assets/images/catPins/cat-pin-5.png'
import catPin6 from '@/assets/images/catPins/cat-pin-6.png'
import catPin7 from '@/assets/images/catPins/cat-pin-7.png'
import catPin8 from '@/assets/images/catPins/cat-pin-8.png'
import catPin9 from '@/assets/images/catPins/cat-pin-9.png'
import catPinMany from '@/assets/images/catPins/cat-pin-many.png'
import {
  MAX_BADGE_COUNT,
  mapViewForSpots,
  pinBadge,
  type MapSize,
  type PinBadge,
  type SightingSpot,
} from '@/src/features/history/lib/history'
import { Image, type ImageRef } from 'expo-image'
import { AppleMaps, GoogleMaps } from 'expo-maps'
import { useEffect, useMemo, useState } from 'react'
import { Platform, View, type LayoutChangeEvent } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './SightingsMap.styles'

/** One key per baked bitmap: 2…MAX_BADGE_COUNT, plus no badge and "9+". */
type PinKey = 'none' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'many'

const PIN_ASSETS: Record<PinKey, number> = {
  none: catPin,
  '2': catPin2,
  '3': catPin3,
  '4': catPin4,
  '5': catPin5,
  '6': catPin6,
  '7': catPin7,
  '8': catPin8,
  '9': catPin9,
  many: catPinMany,
}

const pinKey = (badge: PinBadge): PinKey =>
  badge === 'none' || badge === 'many' ? badge : (`${badge}` as PinKey)

type PinIcons = Partial<Record<PinKey, ImageRef>>

// Loaded once per process; every map mount reuses the native images.
let pinIconsPromise: Promise<PinIcons> | null = null
function loadPinIcons() {
  pinIconsPromise ??= Promise.all(
    (Object.entries(PIN_ASSETS) as [PinKey, number][]).map(
      async ([key, asset]) => [key, await Image.loadAsync(asset)] as const,
    ),
  )
    .then((entries) => Object.fromEntries(entries))
    .catch((error) => {
      // Default markers still work; retry on the next mount.
      console.error('[SightingsMap] loadPinIcons', error)
      pinIconsPromise = null
      return {}
    })
  return pinIconsPromise
}

// The pin tip, not the icon's centre, marks the spot.
const PIN_ANCHOR = { x: 0.5, y: 1 }

const catsLabel = (spot: SightingSpot) =>
  `${spot.catCount} cat${spot.catCount === 1 ? '' : 's'}`

interface SightingsMapProps {
  spots: SightingSpot[]
  onSpotPress: (spot: SightingSpot) => void
  /** True while a finger is on the map — lets a parent pause its scroll. */
  onTouchActiveChange?: (active: boolean) => void
}

export function SightingsMap({
  spots,
  onSpotPress,
  onTouchActiveChange,
}: SightingsMapProps) {
  const { theme } = useUnistyles()
  // Android: null until the bitmaps resolve, so default markers never flash
  // in first. A failed load resolves to {} and falls back to defaults.
  const [icons, setIcons] = useState<PinIcons | null>(
    Platform.OS === 'android' ? null : {},
  )
  const [size, setSize] = useState<MapSize | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'android') return
    let active = true
    loadPinIcons().then((loaded) => {
      if (active) setIcons(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  const view = size ? mapViewForSpots(spots, size) : null
  // Keyed on values, not identity: a tab-focus re-read builds equal spots
  // as new objects, and a new camera object would snap back a user's pan.
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

  if (spots.length === 0) return null

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    if (width !== size?.width || height !== size?.height) {
      setSize({ width, height })
    }
  }
  const handleMarkerClick = ({ id }: { id?: string }) => {
    const spot = spots.find((s) => s.id === id)
    if (spot) onSpotPress(spot)
  }

  return (
    <View
      style={styles.frame}
      onLayout={handleLayout}
      onTouchStart={() => onTouchActiveChange?.(true)}
      onTouchEnd={() => onTouchActiveChange?.(false)}
      onTouchCancel={() => onTouchActiveChange?.(false)}
    >
      {!cameraPosition || !icons ? null : Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.map}
          colorScheme={AppleMaps.MapColorScheme.LIGHT}
          cameraPosition={cameraPosition}
          onMarkerClick={handleMarkerClick}
          markers={spots.map((spot) => {
            const badge = pinBadge(spot.catCount)
            return {
              id: spot.id,
              coordinates: spot,
              title: catsLabel(spot),
              tintColor: theme.colors.accent,
              ...(badge === 'none'
                ? { systemImage: 'cat.fill' }
                : {
                    monogram:
                      badge === 'many' ? `${MAX_BADGE_COUNT}+` : `${badge}`,
                  }),
            }
          })}
        />
      ) : (
        <GoogleMaps.View
          style={styles.map}
          colorScheme={GoogleMaps.MapColorScheme.LIGHT}
          cameraPosition={cameraPosition}
          onMarkerClick={handleMarkerClick}
          uiSettings={{
            mapToolbarEnabled: false,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
          }}
          markers={spots.map((spot) => ({
            id: spot.id,
            coordinates: spot,
            title: catsLabel(spot),
            // The press opens the Sighting; a callout would only flash.
            showCallout: false,
            icon: icons[pinKey(pinBadge(spot.catCount))],
            anchor: PIN_ANCHOR,
          }))}
        />
      )}
    </View>
  )
}
