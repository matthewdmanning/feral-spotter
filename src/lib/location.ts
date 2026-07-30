/**
 * lib/location.ts
 * Best-effort device GPS capture at photo-take time. Never throws and never
 * blocks the caller past `timeoutMs` — callers use this to enrich a photo's
 * exif, not to gate capture on.
 *
 * Gated on the data-collection disclosure, not just OS permission: the app
 * stays usable without consent (photos still capture, submission still
 * works), but location — privileged data per the disclosure — is never
 * touched until the user has accepted it.
 */
import { hasAcceptedConsent } from '@/src/hooks/useConsentStore'
import * as Location from 'expo-location'

export interface CapturedLocation {
  latitude: number
  longitude: number
  accuracy?: number | null
  timestamp: string
}

// Emulators rarely have a usable GPS fix without manually driving Extended
// Controls each run, so stub it in dev to keep the exif-location path
// exercisable without that.
const DEV_STUB_LOCATION = { latitude: 34.6834, longitude: -82.8374 }

export async function captureCurrentLocation(
  timeoutMs = 4000,
): Promise<CapturedLocation | undefined> {
  if (!hasAcceptedConsent()) return undefined

  try {
    // Foreground-only check — the grant itself was already requested at the
    // consent gate (react-native-permissions); this just confirms it's live.
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== Location.PermissionStatus.GRANTED) return undefined

    if (__DEV__) {
      return { ...DEV_STUB_LOCATION, timestamp: new Date().toISOString() }
    }

    const timeout = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    )
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      timeout,
    ])
    if (!fix) return undefined

    return {
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      accuracy: fix.coords.accuracy,
      timestamp: new Date(fix.timestamp).toISOString(),
    }
  } catch {
    return undefined
  }
}
