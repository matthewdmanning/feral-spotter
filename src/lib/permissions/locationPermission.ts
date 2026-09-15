/**
 * lib/permissions/locationPermission.ts
 * Location permission gate (expo-location) (#358). isUsable is the single
 * source of truth for "is this location grant good enough" -- both
 * consent/index.tsx and lib/location.ts's startLocationCapture call this one
 * function, closing a real drift where startLocationCapture's own inline
 * check didn't replicate consent's Android-accuracy gating (a Fine grant
 * later downgraded to Approximate in system Settings would have gone
 * unnoticed by startLocationCapture even though consent's logic considers it
 * unusable).
 */
import * as Location from 'expo-location'
import { Platform } from 'react-native'
import type { PermissionGate } from './types'

// expo-location's `granted` alone isn't enough on Android: choosing
// "Approximate" still resolves granted === true, just with
// `android.accuracy === 'coarse'` — that must gate the same way
// Approximate reading as BLOCKED did under react-native-permissions (#66),
// since a Submission needs a Live fix accurate enough to be usable.
// `ios.accuracy === 'reduced'` intentionally does NOT gate — it didn't
// under the old LIMITED status either, and reduced iOS access is a real,
// working state, unlike Android's coarse-only grant.
export function isUsable(
  response: Location.LocationPermissionResponse,
): boolean {
  return (
    response.granted &&
    !(Platform.OS === 'android' && response.android?.accuracy !== 'fine')
  )
}

export const locationPermission: PermissionGate = {
  async check() {
    return isUsable(await Location.getForegroundPermissionsAsync())
  },
  async request() {
    if (isUsable(await Location.getForegroundPermissionsAsync())) return true
    return isUsable(await Location.requestForegroundPermissionsAsync())
  },
}
