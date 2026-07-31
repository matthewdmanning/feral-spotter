/**
 * screens/submission/location-picker
 * Manual Submission-location selection on a device-native map (ADR 0002).
 * The map is draggable under a fixed centre pin; the Submission location is
 * whatever point sits under the pin when the user confirms. Reached for a
 * `pin` method or as the fallback when a Live fix is unavailable.
 */

import { useSubmissionStore } from '@/src/hooks'
import type { Coordinates } from 'expo-maps'
import { GoogleMaps } from 'expo-maps'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { MapPin } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

// Opened before any fix exists, so it must never start on null island (0,0).
// Falls back to the study area (matches the dev GPS stub).
const DEFAULT_REGION: Required<Coordinates> = {
  latitude: 34.6834,
  longitude: -82.8374,
}
const DEFAULT_ZOOM = 15

// Seed order (ADR 0002): last-known device position → default region. The
// photo-EXIF seed applies only to the library-upload path, which is deferred.
async function resolveSeedRegion(): Promise<Required<Coordinates>> {
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
  return DEFAULT_REGION
}

export default function LocationPickerScreen() {
  const { theme } = useUnistyles()
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )

  const [seed, setSeed] = useState<Required<Coordinates>>(DEFAULT_REGION)
  // Latest map centre, updated as the user drags. A ref (not state) so every
  // camera move doesn't re-render the map.
  const centerRef = useRef<Required<Coordinates>>(DEFAULT_REGION)

  useEffect(() => {
    let active = true
    resolveSeedRegion().then((region) => {
      if (!active) return
      setSeed(region)
      centerRef.current = region
    })
    return () => {
      active = false
    }
  }, [])

  const handleCameraMove = useCallback(
    (event: { coordinates: Coordinates }) => {
      const { latitude, longitude } = event.coordinates
      if (latitude != null && longitude != null) {
        centerRef.current = { latitude, longitude }
      }
    },
    [],
  )

  const handleSetLocation = useCallback(() => {
    setSubmissionLocation(centerRef.current)
    router.back()
  }, [setSubmissionLocation])

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
        <MapPin
          size={40}
          color={theme.colors.accent}
          fill={theme.colors.accent}
          style={styles.pin}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>Drag the map to place the pin</Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            style={[styles.button, styles.cancelButton]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSetLocation}
            accessibilityRole="button"
            style={[styles.button, styles.setButton]}
          >
            <Text style={styles.setButtonText}>Set location</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
