/**
 * config/unistyles.ts
 * Unistyles 3.0 configuration: tokens, themes, breakpoints, and theme mode.
 *
 * MUST be imported before any component that uses StyleSheet.
 * Entry point: index.ts (root of project) imports this after expo-router/entry.
 *
 * v3 API: StyleSheet.configure (replaces UnistylesRegistry)
 */

import { mmkvInstance } from '@/src/lib/cache/storage'
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'

// ─── Tokens (shared across themes) ───────────────────────────────────────────

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const

const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const

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

// ─── Themes ───────────────────────────────────────────────────────────────────

export const darkTheme = {
  colors: {
    background: '#121212',
    surface: '#1A1A1A',
    surfaceAlt: '#242424',
    text: '#E5E7EB',
    textInverse: '#121212',
    muted: '#94A3B8',
    accent: '#0F766E',
    accentAlt: '#64748B',
    accentText: '#FFFFFF',
    success: '#22A06B',
    danger: '#E5484D',
    warning: '#D97706',
    // Tinted card fills behind danger/warning content. These are the values
    // ValidationSheet previously hardcoded, so dark is unchanged by their move
    // into the theme — light is what was broken.
    dangerSurface: '#2A1515',
    warningSurface: '#2A2510',
    border: '#2A2A2A',
    overlay: 'rgba(0,0,0,0.5)',
    cameraOverlay: 'rgba(0,0,0,0.40)',
  },
  spacing,
  radius,
  typography,
} as const

export const lightTheme = {
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    text: '#0F172A',
    textInverse: '#F8FAFC',
    muted: '#64748B',
    accent: '#0F766E',
    accentAlt: '#475569',
    accentText: '#FFFFFF',
    success: '#15803D',
    danger: '#C4342C',
    warning: '#B45309',
    // Pale washes, so the near-black light-theme text stays legible on them.
    dangerSurface: '#FEF2F2',
    warningSurface: '#FFFBEB',
    border: '#E2E8F0',
    overlay: 'rgba(0,0,0,0.3)',
    cameraOverlay: 'rgba(0,0,0,0.30)',
  },
  spacing,
  radius,
  typography,
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
 * Persist a theme mode and apply it immediately.
 *
 * Order matters and is the reason this is a function rather than two calls at
 * the call site: UnistylesRuntime.setTheme throws while adaptive themes are
 * enabled, so adaptive must be turned off before a manual theme is applied.
 */
export function setThemeMode(mode: ThemeMode): void {
  mmkvInstance.set(THEME_MODE_KEY, mode)

  if (mode === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true)
    return
  }

  if (UnistylesRuntime.hasAdaptiveThemes) {
    UnistylesRuntime.setAdaptiveThemes(false)
  }
  UnistylesRuntime.setTheme(mode)
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

// adaptiveThemes and initialTheme are mutually exclusive in Unistyles: the
// first hands theme selection to the OS, the second pins it. Which one is
// passed is exactly the persisted mode.
const initialMode = getThemeMode()

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings:
    initialMode === 'system'
      ? { adaptiveThemes: true }
      : { initialTheme: initialMode },
})
