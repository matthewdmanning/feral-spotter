/**
 * lib/location.ts
 * Best-effort device GPS capture at photo-take time. Never throws and never
 * blocks the caller past `timeoutMs` — callers use this to enrich a photo's
 * exif, not to gate capture on.
 */
import * as Location from "expo-location";

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export async function captureCurrentLocation(
  timeoutMs = 4000,
): Promise<CapturedLocation | undefined> {
  try {
    // Foreground-only check — the grant itself was already requested at the
    // consent gate (react-native-permissions); this just confirms it's live.
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return undefined;

    const timeout = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    );
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      timeout,
    ]);
    if (!fix) return undefined;

    return {
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      timestamp: new Date(fix.timestamp).toISOString(),
    };
  } catch {
    return undefined;
  }
}
