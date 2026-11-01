/**
 * lib/appearance.ts
 * Thin wrapper around RN's Appearance.getColorScheme(), so config/unistyles.ts
 * can be unit-tested with jest.resetModules() without pulling in the real
 * 'react-native' module (its DevMenu/TurboModule chain doesn't survive a
 * fresh require() outside the jest-expo preset's own setup sequence).
 */
import { Appearance } from 'react-native'

export function getSystemColorScheme(): ReturnType<
  typeof Appearance.getColorScheme
> {
  return Appearance.getColorScheme()
}
