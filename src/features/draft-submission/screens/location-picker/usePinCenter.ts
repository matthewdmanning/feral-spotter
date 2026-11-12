/**
 * screens/submission/location-picker/usePinCenter.ts
 * Where the picker map opens, and whether the point under its pin is real.
 */

import type { Coordinates } from 'expo-maps'
import * as Location from 'expo-location'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { useCallback, useEffect, useRef, useState } from 'react'

// Opened before any fix exists, so it must never start on null island (0,0).
// Falls back to the study area (matches the dev GPS stub).
const DEFAULT_REGION: Required<Coordinates> = {
  latitude: 34.6834,
  longitude: -82.8374,
}
export const DEFAULT_ZOOM = 15

// The default region is a placeholder, not a place the user chose. A centre
// within this many degrees of it (about 1 m) still counts as the placeholder.
const PLACEHOLDER_TOLERANCE_DEG = 1e-5

function isPlaceholder({ latitude, longitude }: Required<Coordinates>) {
  return (
    Math.abs(latitude - DEFAULT_REGION.latitude) < PLACEHOLDER_TOLERANCE_DEG &&
    Math.abs(longitude - DEFAULT_REGION.longitude) < PLACEHOLDER_TOLERANCE_DEG
  )
}

// A reopened manual pin wins; otherwise seed from the last-known device
// position → default region (ADR 0002). The photo-EXIF seed applies only to
// the library-upload path, which is deferred. null means no real position:
// the map opens on the placeholder.
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

export interface PinCenter {
  /** Where the map camera opens. */
  seed: Required<Coordinates>
  /** False while the pin sits on the placeholder region. */
  centerKnown: boolean
  handleCameraMove: (event: { coordinates: Coordinates }) => void
  /** The point under the pin now. */
  currentCenter: () => Required<Coordinates>
}

export function usePinCenter(): PinCenter {
  const submission = useSubmissionStore((s) => s.submission)
  const existingPin =
    submission.location_type === 'pin' &&
    submission.latitude != null &&
    submission.longitude != null
      ? {
          latitude: submission.latitude,
          longitude: submission.longitude,
        }
      : null
  const [seed, setSeed] = useState<Required<Coordinates>>(
    () => existingPin ?? DEFAULT_REGION,
  )
  // Latest map centre, updated as the user drags. A ref (not state) so every
  // camera move doesn't re-render the map.
  const centerRef = useRef<Required<Coordinates>>(seed)
  const seededFromExistingPin = existingPin !== null
  // Set location stays off while the pin sits on the placeholder: saving it
  // would record the study area as where this Sighting happened.
  const [centerKnown, setCenterKnown] = useState(() => existingPin !== null)
  const moved = useRef(false)

  useEffect(() => {
    if (seededFromExistingPin) {
      return
    }
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
  }, [seededFromExistingPin])

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

  const currentCenter = useCallback(() => centerRef.current, [])

  return { seed, centerKnown, handleCameraMove, currentCenter }
}
