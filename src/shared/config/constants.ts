/**
 * shared/config/constants.ts
 * App-wide constants and feature flags.
 * Zero React dependencies — safe to import anywhere.
 */

import Constants from 'expo-constants'
// The defining module, not the package index: the index loads the native view.
import {
  NATIVE_FIELD_CONDITIONS,
  type NativeFieldCondition,
} from '@/modules/native-identification-camera/src/types'

/** True in development or release candidate builds. Gates analytics events. */
export const IS_RELEASE_CANDIDATE: boolean =
  Boolean(Constants.expoConfig?.extra?.isReleaseCandidate) || __DEV__

/**
 * Build-time feature flags, kept in source control. They do not depend on
 * analytics consent or the network, so every user gets the same value.
 * Off means the old behavior. To release a feature, set its flag to true
 * and ship a build. Remove the flag once the feature is stable.
 */
export const FEATURE_FLAGS = {
  /** On in development, or when EXPO_PUBLIC_EXPERIMENTAL_CAMERA is "true" at bundle time. */
  experimentalCamera:
    __DEV__ || process.env.EXPO_PUBLIC_EXPERIMENTAL_CAMERA === 'true',
  googleSignIn: true,
  /** Off until the Firebase Console provider and Apple Services ID exist. */
  appleSignIn: false,
  /** Off until the Firebase Console provider and Facebook App ID exist. */
  facebookSignIn: false,
  /** Alpha milestone (docs/planning/2026-07-12-mvp-alpha-beta-roadmap.md, decision 10). On in development. */
  annotationTutorial: __DEV__,
  /** Off: hides the email opt-in step and the Settings toggle. */
  emailUpdates: false,
  /**
   * Master gate: off unless EXPO_PUBLIC_ORGANIZATIONS is "true" at bundle
   * time. On, the PostHog rollout decides, but only after data and analytics
   * consent; without them Organizations stays off.
   */
  organizations: process.env.EXPO_PUBLIC_ORGANIZATIONS === 'true',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/** App version from Expo config, shown in Settings. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0'

const asFieldCondition = (
  value: string | undefined,
): NativeFieldCondition | null =>
  NATIVE_FIELD_CONDITIONS.find((condition) => condition === value) ?? null

/**
 * Android test-drive selector for a candidate field capture config
 * (`low_light`, `distant_motion`, `fine_detail`). Set
 * EXPO_PUBLIC_CAMERA_FIELD_CONDITION in `.env.android.local`. Unset or unknown
 * means null: the capture tuning builds the photo, as before. No settings UI
 * yet: the configs are candidates awaiting a field comparison.
 */
export const CAMERA_FIELD_CONDITION: NativeFieldCondition | null =
  asFieldCondition(process.env.EXPO_PUBLIC_CAMERA_FIELD_CONDITION)

// Shared with storage.rules and functions/ (see config/submissionLimits.ts).
export {
  MAX_PHOTOS,
  MAX_SUBMISSIONS_PER_UID,
} from '@/src/shared/config/submissionLimits'

/**
 * Explicit opt-in tag for test-drive builds with no real Firebase project
 * access — short-circuits submission-metadata upload to a fake success
 * instead of hitting Cloud Storage. Set EXPO_PUBLIC_UPLOADS_MOCK=true (same
 * <AREA>_MOCK convention as EXPO_PUBLIC_AUTH_MOCK). Never on by default
 * (unlike the old __DEV__-based auto-mock) — production and normal dev
 * builds always hit the real backend. Scope matches the old mock exactly:
 * photo uploads (src/features/draft-submission/lib/upload/firebaseUpload.ts's uploadSubmissionPhoto)
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

/**
 * URL of the `syncEmailSubscription` Cloud Function. Unset means email sync is
 * off and the opt-in stays a local flag. Kept in env, not source: it embeds the
 * Firebase project id (see docs/agents/secrets.md).
 */
export const EMAIL_SYNC_URL: string | undefined =
  process.env.EXPO_PUBLIC_EMAIL_SYNC_URL || undefined

/**
 * URL of the `admitPhotoUpload` Cloud Function (#486). storage.rules refuses
 * photo bytes without the upload grant it issues, so unset means photo
 * uploads fail. Kept in env: it embeds the Firebase project id.
 */
export const UPLOAD_ADMISSION_URL: string | undefined =
  process.env.EXPO_PUBLIC_UPLOAD_ADMISSION_URL || undefined

/** Autosave debounce for text inputs (ms). */
export const AUTOSAVE_TEXT_MS = 800

/** Autosave debounce for instant selections — segmented controls (ms). */
export const AUTOSAVE_INSTANT_MS = 400

/** A draft untouched for longer than this is stale: Home stops offering "Continue Observation" and the start-up check discards its photos (ms). */
export const SUBMISSION_STALE_MS = 48 * 60 * 60 * 1000

/** When this app process started. A draft last changed before it was restored from a previous session. */
export const APP_STARTED_AT = Date.now()

/** Gap between the screen's shorter edge and Home's circular entrypoint buttons, as a fraction of the shorter screen side. */
export const ENTRYPOINT_BUFFER_PERCENT = 0.2

/**
 * OS font scale at and above which a ButtonRow stacks its buttons. 1.3 is
 * Android's "Large" step: from there, two pill labels in a 360dp-wide dialog
 * start to wrap.
 */
export const BUTTON_ROW_STACK_FONT_SCALE = 1.3

/**
 * Decimal places for an organization's coverage-center fallback location:
 * two places is about 1 km, enough to name an area without a precise point.
 */
export const COVERAGE_CENTER_FRACTION_DIGITS = 2

/**
 * Open organization views refresh this often, and a membership read stays
 * fresh this long: shared data changes on people's time, not by the second.
 */
export const ORGANIZATION_REFRESH_INTERVAL_MS = 30_000
/** An organization request gives up after this, so a stalled call can be retried. */
export const ORGANIZATION_REQUEST_TIMEOUT_MS = 15_000
/** A shared approximate area is a 0.01° grid cell; more places add nothing. */
export const APPROXIMATE_AREA_FRACTION_DIGITS = 2
/** Five places is about 1 m: the precision a phone fix actually has. */
export const PRECISE_LOCATION_FRACTION_DIGITS = 5
