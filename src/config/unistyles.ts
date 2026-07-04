/**
 * config/unistyles.ts
 * Unistyles 3.0 configuration.
 *
 * MUST be imported before any component that uses StyleSheet.
 * Entry point: index.ts (root of project) imports this after expo-router/entry.
 *
 * v3 API: StyleSheet.configure (replaces UnistylesRegistry)
 */

import { mmkvInstance } from "@/src/lib/cache/storage";
import { StyleSheet } from "react-native-unistyles";

// ─── Tokens (shared across themes) ───────────────────────────────────────────

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

// ─── Themes ───────────────────────────────────────────────────────────────────

export const darkTheme = {
  colors: {
    background: "#0B0B0C",
    surface: "#151518",
    surfaceAlt: "#1D1D22",
    text: "#F5F5F7",
    textInverse: "#0B0B0C",
    muted: "#9B9BA1",
    accent: "#6EA8FE",
    accentText: "#0B0B0C",
    success: "#58C27D",
    danger: "#FF6B6B",
    warning: "#FFD93D",
    border: "#2C2C2E",
    overlay: "rgba(0,0,0,0.5)",
    cameraOverlay: "rgba(0,0,0,0.40)",
  },
  spacing,
  radius,
  typography,
} as const;

export const lightTheme = {
  colors: {
    background: "#F5F5F7",
    surface: "#FFFFFF",
    surfaceAlt: "#F0F0F2",
    text: "#0B0B0C",
    textInverse: "#F5F5F7",
    muted: "#6B6B71",
    accent: "#2563EB",
    accentText: "#FFFFFF",
    success: "#16A34A",
    danger: "#DC2626",
    warning: "#D97706",
    border: "#D1D1D6",
    overlay: "rgba(0,0,0,0.3)",
    cameraOverlay: "rgba(0,0,0,0.30)",
  },
  spacing,
  radius,
  typography,
} as const;

// ─── TypeScript augmentation ──────────────────────────────────────────────────

const appThemes = { dark: darkTheme, light: lightTheme };
export type AppTheme = typeof darkTheme;

type AppThemes = typeof appThemes;
declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {} // eslint-disable-line @typescript-eslint/no-empty-object-type
}

// ─── Configure ───────────────────────────────────────────────────────────────

StyleSheet.configure({
  themes: appThemes,
  settings: {
    // Read persisted preference; fall back to dark.
    // Must be synchronous — MMKV satisfies this.
    initialTheme: () =>
      (mmkvInstance.getString("preferredTheme") as "dark" | "light") ?? "dark",
    adaptiveThemes: false, // user-controlled; toggle via UnistylesRuntime.setAdaptiveThemes
  },
});
