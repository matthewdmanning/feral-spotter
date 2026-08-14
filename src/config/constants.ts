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
 * Maximum distinct submissions per uidHash (#270), enforced by
 * storage.rules' isValidMetadataWrite against the
 * submissionCounts/{uidHash} doc functions/src/index.ts maintains.
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
 * Salt folded into the per-photo user-id hash (#264 amendment to
 * ADR-0002/ADR-0003) before hashing, so the hash isn't a plain re-derivable
 * SHA-256(uid) that anyone with the Firebase Auth user list could recompute
 * and match. Used for both the `user_id_hash` customMetadata field and the
 * Storage object path's owner segment (`hashUid()` in firebaseUpload.ts,
 * ADR-0005) — the raw uid never appears in either place. Deliberately not a
 * secret: storage.rules/firestore.rules recompute the same hash from
 * request.auth.uid via the rules language's own hashing.sha256(), so this
 * value must match what's embedded in those two files.
 */
export const USER_ID_HASH_SALT = 'feralspotter-photo-metadata-uid-v1'

/** Autosave debounce for text inputs (ms). */
export const AUTOSAVE_TEXT_MS = 800

/** Autosave debounce for instant selections — segmented controls (ms). */
export const AUTOSAVE_INSTANT_MS = 400

/** Autosave status display duration after save completes (ms). */
export const AUTOSAVE_CLEAR_MS = 2000
