/**
 * config/constants.ts
 * App-wide constants and feature flags.
 * Zero React dependencies — safe to import anywhere.
 */

import Constants from 'expo-constants'

/** True in development or pre-release builds. Gates analytics events. */
export const IS_PRERELEASE: boolean =
  Boolean(Constants.expoConfig?.extra?.isPrerelease) || __DEV__

/** App version from Expo config. */
export const APP_VERSION: string =
  Constants.expoConfig?.version ?? '1.0.0'

/** Maximum photos per submission. */
export const MAX_PHOTOS = 20

/** Autosave debounce for text inputs (ms). */
export const AUTOSAVE_TEXT_MS = 800

/** Autosave debounce for instant selections — segmented controls (ms). */
export const AUTOSAVE_INSTANT_MS = 400

/** Autosave status display duration after save completes (ms). */
export const AUTOSAVE_CLEAR_MS = 2000
