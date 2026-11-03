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
import { GoogleMaps } from 'expo-maps'
import { router } from 'expo-router'
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin'
import { useCallback } from 'react'
import { Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'
import { DEFAULT_ZOOM, usePinCenter } from './usePinCenter'

export default function LocationPickerScreen() {
  const { theme } = useUnistyles()
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )
  const setLocationType = useSubmissionStore((s) => s.setLocationType)

  const { seed, centerKnown, handleCameraMove, currentCenter } = usePinCenter()

  const handleSetLocation = useCallback(() => {
    // Mark this as a manual pin first — the background Live-fix reacquire
    // (src/lib/location.ts) checks this before writing a new fix, so it
    // never clobbers a location the user picked by hand.
    setLocationType('pin')
    setSubmissionLocation(currentCenter())
    router.back()
  }, [setLocationType, setSubmissionLocation, currentCenter])

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
