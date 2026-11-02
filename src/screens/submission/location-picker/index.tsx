/**
 * screens/submission/location-picker
 * Manual Submission-location selection on a device-native map (ADR 0002).
 * The map is draggable under a fixed centre pin; the Submission location is
 * whatever point sits under the pin when the user confirms. Reached for a
 * `pin` method or as the fallback when a Live fix is unavailable.
 */

import { AppButton } from '@/src/components/atoms/AppButton'
import { ButtonRow } from '@/src/components/molecules/ButtonRow'
import { useSubmissionStore } from '@/src/hooks'
import type { Coordinates } from 'expo-maps'
import { GoogleMaps } from 'expo-maps'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

// Opened before any fix exists, so it must never start on null island (0,0).
// Falls back to the study area (matches the dev GPS stub).
const DEFAULT_REGION: Required<Coordinates> = {
  latitude: 34.6834,
  longitude: -82.8374,
}
const DEFAULT_ZOOM = 15

// The default region is a placeholder, not a place the user chose. A centre
// within this many degrees of it (about 1 m) still counts as the placeholder.
const PLACEHOLDER_TOLERANCE_DEG = 1e-5

function isPlaceholder({ latitude, longitude }: Required<Coordinates>) {
  return (
    Math.abs(latitude - DEFAULT_REGION.latitude) < PLACEHOLDER_TOLERANCE_DEG &&
    Math.abs(longitude - DEFAULT_REGION.longitude) < PLACEHOLDER_TOLERANCE_DEG
  )
}

// Seed order (ADR 0002): last-known device position → default region. The
// photo-EXIF seed applies only to the library-upload path, which is deferred.
// null means no real position: the map opens on the placeholder.
async function resolveSeedRegion(): Promise<Required<Coordinates> | null> {
  try {
    const last = await Location.getLastKnownPositionAsync()
    if (last) {
      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      }
    }
  } catch {
    // fall through to the default region
  }
  return null
}

export default function LocationPickerScreen() {
  const { theme } = useUnistyles()
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )
  const setLocationType = useSubmissionStore((s) => s.setLocationType)

  const [seed, setSeed] = useState<Required<Coordinates>>(DEFAULT_REGION)
  // Latest map centre, updated as the user drags. A ref (not state) so every
  // camera move doesn't re-render the map.
  const centerRef = useRef<Required<Coordinates>>(DEFAULT_REGION)
  // Set location stays off while the pin sits on the placeholder: saving it
  // would record the study area as where this Sighting happened.
  const [centerKnown, setCenterKnown] = useState(false)
  const moved = useRef(false)

  useEffect(() => {
    let active = true
    resolveSeedRegion().then((region) => {
      // A drag that beat the seed wins: re-centring would throw it away.
      if (!active || !region || moved.current) return
      setSeed(region)
      centerRef.current = region
      setCenterKnown(true)
    })
    return () => {
      active = false
    }
  }, [])

  const handleCameraMove = useCallback(
    (event: { coordinates: Coordinates }) => {
      const { latitude, longitude } = event.coordinates
      if (latitude == null || longitude == null) return
      const center = { latitude, longitude }
      centerRef.current = center
      if (isPlaceholder(center)) return
      moved.current = true
      setCenterKnown(true)
    },
    [],
  )

  const handleSetLocation = useCallback(() => {
    // Mark this as a manual pin first — the background Live-fix reacquire
    // (src/lib/location.ts) checks this before writing a new fix, so it
    // never clobbers a location the user picked by hand.
    setLocationType('pin')
    setSubmissionLocation(centerRef.current)
    router.back()
  }, [setLocationType, setSubmissionLocation])

  const handleCancel = useCallback(() => {
    router.back()
  }, [])

  return (
    <View style={styles.root}>
      <GoogleMaps.View
        style={styles.map}
        cameraPosition={{ coordinates: seed, zoom: DEFAULT_ZOOM }}
        onCameraMove={handleCameraMove}
      />

      {/* Fixed centre pin — a non-interactive overlay, not a map marker. The
          tip sits at the map centre (translated up by its own height). */}
      <View style={styles.pinOverlay} pointerEvents="none">
        <MapPinIcon
          size={theme.iconSize.xxl}
          color={theme.colors.accent}
          weight="fill"
          style={styles.pin}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>
          {centerKnown
            ? 'Drag the map to place the pin'
            : 'No location yet. Drag the map to where you saw the cat.'}
        </Text>
        <ButtonRow>
          <AppButton variant="secondary" onPress={handleCancel}>
            Cancel
          </AppButton>
          <AppButton onPress={handleSetLocation} disabled={!centerKnown}>
            Set location
          </AppButton>
        </ButtonRow>
      </View>
    </View>
  )
}
