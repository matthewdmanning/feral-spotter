/**
 * shared/analytics/analytics.ts
 *
 * PostHog analytics. Every capture path is gated by analyticsAllowed():
 * release candidate build (IS_RELEASE_CANDIDATE, from app config extra),
 * general consent, and the analytics opt-in. The SDK client itself lives in
 * providers/AppProviders.tsx.
 */

import { IS_RELEASE_CANDIDATE } from '@/src/shared/config/constants'
import {
  hasAcceptedAnalytics,
  useConsentStore,
  hasAcceptedConsent,
} from '@/src/shared/consent/useConsentStore'
import { getPendingDeletion } from '@/src/shared/lib/pendingDeletion'
import type { PostHogEventProperties } from '@posthog/core'

export { IS_RELEASE_CANDIDATE }

// ─── Event names ──────────────────────────────────────────────────────────────

export const EVENTS = {
  SUBMISSION_SENDING: 'submission_sending',
  SUBMISSION_SUBMITTED: 'submission_submitted',
  SUBMISSION_FAILED: 'submission_failed',
  /**
   * One per focused History view, with account-owned counts. Replaces
   * `feral_reports_viewed`, which fired once per cached Submission.
   */
  SIGHTING_HISTORY_VIEWED: 'sighting_history_viewed',
  CAMERA_OPENED: 'camera_opened',
  CAMERA_DEVICE_READY: 'camera_device_ready',
  CAMERA_NATIVE_DIAGNOSTIC: 'camera_native_diagnostic',
  CAMERA_CAPTURE_SEQUENCE_COMPLETED: 'camera_capture_sequence_completed',
  PHOTO_CAPTURED: 'photo_captured',
  PHOTO_CAPTURE_FAILED: 'photo_capture_failed',
  LIBRARY_PHOTOS_SELECTED: 'library_photos_selected',
  CAT_BOXING_COMPLETED: 'cat_boxing_completed',
  CAT_OBSERVATION_SAVED: 'cat_observation_saved',
  TUTORIAL_STARTED: 'tutorial_started',
  TUTORIAL_STEP_COMPLETED: 'tutorial_step_completed',
  TUTORIAL_SKIPPED: 'tutorial_skipped',
  TUTORIAL_COMPLETED: 'tutorial_completed',
} as const

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS]

// ─── PostHog singleton access ─────────────────────────────────────────────────
// AnalyticsBridge (providers/AppProviders.tsx) registers the SDK's capturers
// while PostHog is mounted, and unregisters them (null) when it unmounts.

type Capture = (event: string, props?: PostHogEventProperties) => void
type CaptureException = (error: unknown, extra?: PostHogEventProperties) => void

let registeredCapture: Capture | null = null
let registeredCaptureException: CaptureException | null = null

/**
 * Calls made after consent but before the SDK registers (#197: consent flips,
 * then navigation fires events before AnalyticsBridge's effect runs). Replayed
 * on registration and re-checked against the gate. Past the cap the oldest is
 * dropped, so a build with no PostHog configuration cannot grow it unbounded.
 */
type Pending =
  | { kind: 'event'; event: string; props?: PostHogEventProperties }
  | { kind: 'exception'; error: unknown; extra?: PostHogEventProperties }

export const MAX_PENDING_CAPTURES = 50
const pending: Pending[] = []

function enqueue(item: Pending): void {
  if (pending.length >= MAX_PENDING_CAPTURES) pending.shift()
  pending.push(item)
}

function replayPending(): void {
  const capture = registeredCapture
  const captureError = registeredCaptureException
  if (!capture || !captureError) return
  const items = pending.splice(0)
  if (!analyticsAllowed()) return
  for (const item of items) {
    if (item.kind === 'event') capture(item.event, item.props)
    else captureError(item.error, item.extra)
  }
}

/** Register the SDK's capture; null on unmount. Replays pending calls. */
export function registerCapture(fn: Capture | null): void {
  registeredCapture = fn
  replayPending()
}

/** Register the SDK's exception capture; null on unmount. Replays pending calls. */
export function registerCaptureException(fn: CaptureException | null): void {
  registeredCaptureException = fn
  replayPending()
}

/** Drop every pending call. */
export function clearPendingCaptures(): void {
  pending.length = 0
}

useConsentStore.subscribe((state, previous) => {
  if (
    state.activeUid !== previous.activeUid ||
    (previous.analyticsAccepted === true && !analyticsAllowed())
  ) {
    clearPendingCaptures()
    registeredCapture = null
    registeredCaptureException = null
  }
})

/** Same gate as every capture path: release candidate build, general consent, analytics opt-in. */
export function analyticsAllowed(): boolean {
  return (
    IS_RELEASE_CANDIDATE &&
    hasAcceptedConsent() &&
    hasAcceptedAnalytics() &&
    // An unfinished deletion may already have erased the analytics person.
    getPendingDeletion() === null
  )
}

// ─── Fire event ───────────────────────────────────────────────────────────────

/**
 * Fire a PostHog event that isn't tied to a submission cache file (e.g. a
 * funnel or failure event from the camera/annotate flow). Same gating as
 * every capture path. Sighting events go through `fireAnalyticsEvent`
 * (features/draft-submission/lib/analytics.ts).
 */
export function captureEvent(
  event: AnalyticsEvent,
  props?: PostHogEventProperties,
): void {
  if (!analyticsAllowed()) return
  if (!registeredCapture) {
    enqueue({ kind: 'event', event, props })
    return
  }
  registeredCapture(event, props)
}

/**
 * Report an exception to PostHog Error Tracking, gated identically to every
 * other capture path — a stale registered capturer must not fire
 * post-revocation. Use for handled failures the user felt (a failed send, a
 * failed capture) so they carry a stack, not only a funnel event.
 */
export function captureException(
  error: unknown,
  extra?: PostHogEventProperties,
): void {
  if (!analyticsAllowed()) return
  if (!registeredCaptureException) {
    enqueue({ kind: 'exception', error, extra })
    return
  }
  registeredCaptureException(error, extra)
}

/**
 * Log a handled failure and report it to Error Tracking with its call site
 * as `error_source`, so failures the app recovers from still show up
 * grouped. `source` is the console tag. Keep PII out of `extra`.
 */
export function reportError(
  source: string,
  error: unknown,
  extra?: PostHogEventProperties,
): void {
  console.error(source, error)
  captureHandledError(source, extra)
}

/** Report a handled failure that already has a local log entry. */
export function captureHandledError(
  source: string,
  extra?: PostHogEventProperties,
): void {
  if (!analyticsAllowed()) return
  // Upstream error messages can contain account data, file paths or request bodies.
  captureException(new Error(source), { ...extra, error_source: source })
}
