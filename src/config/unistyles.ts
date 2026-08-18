/**
 * config/unistyles.ts
 * Unistyles 3.0 configuration.
 *
 * MUST be imported before any component that uses StyleSheet.
 * Entry point: index.ts (root of project) imports this after expo-router/entry.
 *
 * v3 API: StyleSheet.configure (replaces UnistylesRegistry)
 */

import { mmkvInstance } from '@/src/lib/cache/storage'
import { StyleSheet } from 'react-native-unistyles'

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
    border: '#E2E8F0',
    overlay: 'rgba(0,0,0,0.3)',
    cameraOverlay: 'rgba(0,0,0,0.30)',
  },
  spacing,
  radius,
  typography,
} as const

// ─── TypeScript augmentation ──────────────────────────────────────────────────

const appThemes = { dark: darkTheme, light: lightTheme }
export type AppTheme = typeof darkTheme

type AppThemes = typeof appThemes
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {} // eslint-disable-line @typescript-eslint/no-empty-object-type
}

// ─── Configure ───────────────────────────────────────────────────────────────

StyleSheet.configure({
  themes: appThemes,
  settings: {
    // Read persisted preference; fall back to dark.
    // Must be synchronous — MMKV satisfies this.
    initialTheme: () =>
      (mmkvInstance.getString('preferredTheme') as 'dark' | 'light') ?? 'dark',
    adaptiveThemes: false, // user-controlled; toggle via UnistylesRuntime.setAdaptiveThemes
  },
})
