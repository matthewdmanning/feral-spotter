/**
 * config/unistyles.ts
 * Unistyles 3.0 configuration: tokens, themes, breakpoints, and theme mode.
 *
 * MUST be imported before any component that uses StyleSheet.
 * Entry point: index.ts (root of project) imports this after expo-router/entry.
 *
 * v3 API: StyleSheet.configure (replaces UnistylesRegistry)
 */

import { getSystemColorScheme } from '@/src/lib/appearance'
import { mmkvInstance } from '@/src/lib/cache/storage'
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'

import { darkTheme, lightTheme } from './themes'

export { darkTheme, lightTheme }

// ─── Breakpoints ─────────────────────────────────────────────────────────────

/**
 * Screen-width breakpoints. The first entry MUST be 0: Unistyles cascades like
 * CSS, so a set that doesn't start at 0 leaves the narrowest screens with no
 * matching value at all.
 *
 * Convention for values that must differ by device — both mechanisms are built
 * into Unistyles, so neither needs a scaling helper written by hand:
 *
 *   Varies by screen WIDTH (layout, max widths, column counts)
 *     -> breakpoint-keyed object:  { padding: { xs: 8, md: 24 } }
 *
 *   Derived from the DEVICE itself (safe-area insets, OS font scale, density)
 *     -> the runtime argument:     StyleSheet.create((theme, rt) => ({
 *                                    paddingTop: rt.insets.top,
 *                                    fontSize: rt.fontScale * theme.typography.base,
 *                                  }))
 *
 * Reach for `rt.fontScale` rather than fixed sizes anywhere shrinking text
 * would hurt legibility — it carries the OS accessibility text-size setting.
 */
const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const

// ─── Theme mode ──────────────────────────────────────────────────────────────

/**
 * How the active theme is chosen. 'system' follows the OS appearance setting;
 * 'light' and 'dark' pin it regardless of the OS.
 */
export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * MMKV is used rather than AsyncStorage because Unistyles resolves the initial
 * theme synchronously, before the first render. An async read here would paint
 * the wrong theme and then flip it.
 *
 * Note this replaces an older 'preferredTheme' key that was read at startup and
 * written by nothing — no migration is needed because no device ever held a
 * value under it.
 */
const THEME_MODE_KEY = 'themeMode'

const isThemeMode = (value: string | undefined): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark'

/** Persisted theme mode, defaulting to 'system' for anyone who hasn't chosen. */
export function getThemeMode(): ThemeMode {
  const stored = mmkvInstance.getString(THEME_MODE_KEY)
  return isThemeMode(stored) ? stored : 'system'
}

/**
 * 'system' resolves through React Native's own Appearance API rather than
 * Unistyles' adaptiveThemes setting. #338 found adaptiveThemes does not
 * track a live OS change in this app (confirmed on-device, not just
 * theoretical) — Appearance.addChangeListener does, in every environment,
 * so system mode is driven from there end to end (see resolveSystemTheme's
 * caller in AppProviders for the live half; this is just the initial read).
 */
export function resolveSystemTheme(): 'light' | 'dark' {
  return getSystemColorScheme() === 'light' ? 'light' : 'dark'
}

/** Persist a theme mode and apply it immediately. */
export function setThemeMode(mode: ThemeMode): void {
  mmkvInstance.set(THEME_MODE_KEY, mode)
  UnistylesRuntime.setTheme(mode === 'system' ? resolveSystemTheme() : mode)
}

/**
 * Pure decision behind AppProviders' SystemThemeSync (the live half of
 * #338): given what Appearance just reported and the currently persisted
 * mode, what should the runtime theme become — or null to leave it alone.
 * An explicit Light/Dark choice must never be overridden by an OS change,
 * which is why this takes the mode as an argument rather than assuming
 * 'system' the way resolveSystemTheme does.
 */
export function resolveThemeForAppearanceChange(
  colorScheme: string | null | undefined,
  mode: ThemeMode,
): 'light' | 'dark' | null {
  if (mode !== 'system') return null
  return colorScheme === 'light' ? 'light' : 'dark'
}

// ─── TypeScript augmentation ──────────────────────────────────────────────────

const appThemes = { dark: darkTheme, light: lightTheme }
export type AppTheme = typeof darkTheme

type AppThemes = typeof appThemes
type AppBreakpoints = typeof breakpoints
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {} // eslint-disable-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {} // eslint-disable-line @typescript-eslint/no-empty-object-type
}

// ─── Configure ───────────────────────────────────────────────────────────────

// Always initialTheme, never adaptiveThemes — see resolveSystemTheme's
// comment above for why 'system' mode is driven from Appearance instead.
const initialMode = getThemeMode()

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    initialTheme: initialMode === 'system' ? resolveSystemTheme() : initialMode,
  },
})
