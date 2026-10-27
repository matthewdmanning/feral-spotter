/**
 * components/organisms/ReportsMap.tsx
 * Map overview at the top of the Reports tab: one cat-head pin per spot the
 * user has reported from. A spot with more than one cat carries the count in
 * a badge at the icon's bottom right (9+ past nine). Pressing a pin opens
 * the newest Sighting at that spot.
 *
 * Android draws baked bitmaps (scripts/generate-cat-pins.py) — Google Maps
 * markers take an image, not a view, so the badge is part of the bitmap.
 * Apple Maps markers take no custom image: iOS shows an SF Symbol cat for one
 * cat and the count as the marker's monogram for more (iOS 17+).
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
  type PinBadge,
  type ReportSpot,
} from '@/src/lib/reports/history'
import { Image, type ImageRef } from 'expo-image'
import { AppleMaps, GoogleMaps } from 'expo-maps'
import { useEffect, useMemo, useState } from 'react'
import { Platform, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './ReportsMap.styles'

type PinKey = 'none' | `${number}` | 'many'

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
  badge === 'none' || badge === 'many' ? badge : `${badge}`

// Loaded once per process; every map mount reuses the native images.
let pinIconsPromise: Promise<Partial<Record<PinKey, ImageRef>>> | null = null
function loadPinIcons() {
  pinIconsPromise ??= Promise.all(
    (Object.entries(PIN_ASSETS) as [PinKey, number][]).map(
      async ([key, asset]) => [key, await Image.loadAsync(asset)] as const,
    ),
  )
    .then((entries) => Object.fromEntries(entries))
    .catch((error) => {
      // Default markers still work; retry on the next mount.
      console.error('[ReportsMap] loadPinIcons', error)
      pinIconsPromise = null
      return {}
    })
  return pinIconsPromise
}

// The pin tip, not the icon's centre, marks the spot.
const PIN_ANCHOR = { x: 0.5, y: 1 }

interface ReportsMapProps {
  spots: ReportSpot[]
  onSpotPress: (spot: ReportSpot) => void
}

export function ReportsMap({ spots, onSpotPress }: ReportsMapProps) {
  const { theme } = useUnistyles()
  const [icons, setIcons] = useState<Partial<Record<PinKey, ImageRef>>>({})

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

  // Frame every pin once per set of spots — not on every render, which
  // would snap the camera back while the user pans.
  const view = useMemo(() => mapViewForSpots(spots), [spots])
  if (!view) return null

  const cameraPosition = { coordinates: view.coordinates, zoom: view.zoom }
  const handleMarkerClick = ({ id }: { id?: string }) => {
    const spot = spots.find((s) => s.id === id)
    if (spot) onSpotPress(spot)
  }
  const catsLabel = (spot: ReportSpot) =>
    `${spot.catCount} cat${spot.catCount === 1 ? '' : 's'}`

  return (
    <View
      style={styles.frame}
      accessibilityLabel={`Map of ${spots.length} reported spot${spots.length === 1 ? '' : 's'}`}
    >
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.map}
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
