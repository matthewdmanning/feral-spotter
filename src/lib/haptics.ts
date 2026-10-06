/**
 * lib/haptics.ts
 * Tap and selection haptics, gated by a user setting that is on by default.
 *
 * Android goes through performAndroidHapticsAsync (View.performHapticFeedback),
 * which honors the OS "Vibrate on tap" setting and needs no VIBRATE
 * permission. impactAsync would bypass that setting on Android. iOS uses the
 * UIKit feedback generators: light impact for a button, selection for a
 * change of choice — the pairing Apple's HIG recommends.
 *
 * MMKV, not AsyncStorage: the setting is read on every press, so it must be
 * synchronous.
 */

import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'
import { mmkvInstance } from '@/src/lib/cache/storage'

const HAPTICS_ENABLED_KEY = 'hapticsEnabled'

export function getHapticsEnabled(): boolean {
  return mmkvInstance.getBoolean(HAPTICS_ENABLED_KEY) ?? true
}

export function setHapticsEnabled(enabled: boolean): void {
  mmkvInstance.set(HAPTICS_ENABLED_KEY, enabled)
}

// Haptics are decoration: an unsupported constant or a missing engine must
// never surface as an error on a button press.
const ignore = () => {}

/** A button press. Call from onPressIn so the click lands with the finger. */
export function tapHaptic(): void {
  if (!getHapticsEnabled()) return
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(
      Haptics.AndroidHaptics.Virtual_Key,
    ).catch(ignore)
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore)
  }
}

/** A change of choice: a tab, a segment, a toggle. */
export function selectionHaptic(): void {
  if (!getHapticsEnabled()) return
  if (Platform.OS === 'android') {
    // Clock_Tick exists on every API level; Segment_Tick needs API 34.
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick).catch(
      ignore,
    )
  } else {
    Haptics.selectionAsync().catch(ignore)
  }
}
