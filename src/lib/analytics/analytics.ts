/**
 * utils/analytics.ts
 *
 * PostHog analytics, guarded by IS_PRERELEASE.
 * Events are only fired in pre-release / staging builds.
 *
 * Setup:
 *   npx expo install posthog-react-native
 *   Wrap app root with <PostHogProvider apiKey="...">
 *
 * IS_PRERELEASE is read from Expo's app config extra field.
 * Set in app.config.js / app.json:
 *   "extra": { "isPrerelease": true }
 */

import { hasAcceptedAnalytics, hasAcceptedConsent } from "@/src/hooks/useConsentStore";
import type { SubmissionCacheFile } from "@/src/lib/cache/submissionCache";
import Constants from "expo-constants";
import type { PostHogEventProperties } from "@posthog/core";

// ─── Flag ─────────────────────────────────────────────────────────────────────

export const IS_PRERELEASE: boolean =
  Boolean(Constants.expoConfig?.extra?.isPrerelease) || __DEV__;

// ─── Event names ──────────────────────────────────────────────────────────────

export const EVENTS = {
  SUBMISSION_SENDING: "submission_sending",
  SUBMISSION_SUBMITTED: "submission_submitted",
  SUBMISSION_FAILED: "submission_failed",
  REPORTS_VIEWED: "feral_reports_viewed",
  CAMERA_OPENED: "camera_opened",
  PHOTO_CAPTURE_FAILED: "photo_capture_failed",
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

// ─── PostHog singleton access ─────────────────────────────────────────────────
// We import usePostHog() at call sites for hook contexts.
// For non-hook contexts (utils), use the client directly if needed.

let _capture:
  | ((event: string, props?: PostHogEventProperties) => void)
  | null = null;

/** Call once in a component that has PostHog context to register the capturer. */
export function registerCapture(
  fn: (event: string, props?: PostHogEventProperties) => void,
): void {
  _capture = fn;
}

let _captureException:
  | ((error: unknown, extra?: PostHogEventProperties) => void)
  | null = null;

/** Call once in a component that has PostHog context to register the exception capturer. */
export function registerCaptureException(
  fn: (error: unknown, extra?: PostHogEventProperties) => void,
): void {
  _captureException = fn;
}

/** Same gate as every capture path: pre-release build, general consent, analytics opt-in. */
function shouldCapture(): boolean {
  return IS_PRERELEASE && hasAcceptedConsent() && hasAcceptedAnalytics();
}

// ─── Fire event ───────────────────────────────────────────────────────────────

/**
 * Fire a PostHog event, but only when IS_PRERELEASE is true and the user has
 * accepted the data-collection disclosure. Includes the full cache file as
 * event properties.
 */
export function fireAnalyticsEvent(
  event: AnalyticsEvent,
  cache: SubmissionCacheFile,
  extra?: Record<string, unknown>,
): void {
  if (!shouldCapture()) return;
  if (!_capture) {
    console.warn(
      "[analytics] capturer not registered — call registerCapture() in a PostHog-wrapped component",
    );
    return;
  }

  _capture(event, {
    cache_id: cache.id,
    cache_status: cache.status,
    created_at: cache.created_at,
    location_method: cache.metadata.location_method,
    time_method: cache.metadata.time_method,
    cat_count: cache.cats.length,
    photo_count: cache.photo_links?.length ?? 0,
    // Full cache payload for pre-release debugging
    cache_snapshot: JSON.stringify(cache),
    ...extra,
  });
}

/**
 * Fire a PostHog event that isn't tied to a submission cache file (e.g. a
 * funnel or failure event from the camera/annotate flow). Same gating as
 * fireAnalyticsEvent.
 */
export function captureEvent(
  event: AnalyticsEvent,
  props?: PostHogEventProperties,
): void {
  if (!shouldCapture()) return;
  if (!_capture) {
    console.warn(
      "[analytics] capturer not registered — call registerCapture() in a PostHog-wrapped component",
    );
    return;
  }

  _capture(event, props);
}

/**
 * Report an exception to PostHog, gated identically to every other capture
 * path (pre-release, consent, analytics opt-in) — a stale registered capturer
 * must not fire post-revocation.
 */
export function captureException(
  error: unknown,
  extra?: PostHogEventProperties,
): void {
  if (!shouldCapture()) return;
  if (!_captureException) {
    console.warn(
      "[analytics] exception capturer not registered — call registerCaptureException() in a PostHog-wrapped component",
    );
    return;
  }

  _captureException(error, extra);
}
