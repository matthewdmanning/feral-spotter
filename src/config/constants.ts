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
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0'

/** Maximum photos per submission. Override via EXPO_PUBLIC_MAX_PHOTOS. */
export const MAX_PHOTOS = Number(process.env.EXPO_PUBLIC_MAX_PHOTOS) || 10

/**
 * Maximum distinct submissions per uid (#270), enforced by
 * storage.rules' isValidMetadataWrite against the
 * submissionCounts/{uid} doc functions/src/index.ts maintains.
 * Documentation only — rules can't read this constant, so the literal in
 * storage.rules must be kept in sync by hand.
 */
export const MAX_SUBMISSIONS_PER_UID = 250

/**
 * Explicit opt-in tag for test-drive builds with no real Firebase project
 * access — short-circuits submission-metadata upload to a fake success
 * instead of hitting Cloud Storage. Set EXPO_PUBLIC_UPLOADS_MOCK=true (same
 * <AREA>_MOCK convention as EXPO_PUBLIC_AUTH_MOCK). Never on by default
 * (unlike the old __DEV__-based auto-mock) — production and normal dev
 * builds always hit the real backend. Scope matches the old mock exactly:
 * photo uploads (src/lib/upload/firebaseUpload.ts's uploadSubmissionPhoto)
 * were never mocked either, and still aren't — this only covers the final
 * metadata write, so it doesn't unblock a full offline test drive on its own.
 */
export const UPLOADS_MOCK: boolean =
  process.env.EXPO_PUBLIC_UPLOADS_MOCK === 'true'

/**
 * Opt-in tag to connect the real Firebase Auth + Storage instances to the
 * Local Emulator Suite (`firebase emulators:start`) instead of the live
 * project, for test-drives. Same <AREA>_MOCK convention as
 * EXPO_PUBLIC_AUTH_MOCK/EXPO_PUBLIC_UPLOADS_MOCK, but suite-wide rather than
 * per-area — Auth and Storage emulators are meant to be exercised together,
 * not independently. Never on by default.
 */
export const USE_FIREBASE_EMULATOR: boolean =
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true'

/**
 * Local Emulator Suite host, used only when USE_FIREBASE_EMULATOR is set.
 * Defaults to localhost (physical device via `adb reverse`, this project's
 * existing live-run convention). Override to 10.0.2.2 for the Android
 * Studio emulator, which can't resolve the host machine as localhost.
 */
export const FIREBASE_EMULATOR_HOST: string =
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? 'localhost'

/** Local Emulator Suite ports — must match firebase.json's `emulators` block. */
export const AUTH_EMULATOR_PORT = 9099
export const STORAGE_EMULATOR_PORT = 9199

/** Autosave debounce for text inputs (ms). */
export const AUTOSAVE_TEXT_MS = 800

/** Autosave debounce for instant selections — segmented controls (ms). */
export const AUTOSAVE_INSTANT_MS = 400

/** Autosave status display duration after save completes (ms). */
export const AUTOSAVE_CLEAR_MS = 2000

/** An in-progress submission older than this is too stale to offer "Continue Observation" for (ms). */
export const SUBMISSION_STALE_MS = 24 * 60 * 60 * 1000

/** Gap between the screen's shorter edge and Home's circular entrypoint buttons, as a fraction of the shorter screen side. */
export const ENTRYPOINT_BUFFER_PERCENT = 0.2
