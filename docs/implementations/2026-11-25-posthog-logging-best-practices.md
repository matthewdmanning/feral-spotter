# PostHog logging: consent, identity, drops, screens, errors

**Scope:** fix + extension
**Issues/spec:** user request "PostHog best practices for a non-monetized app; reduce friction and bugs"; #197 (capture drop before registration)
**Date:** 2026-11-25
**Branch/PR:** `claude/posthog-logging-best-practices-mhw8jo`

## Scope

**In scope:**

- [x] Revoked analytics stops all SDK sending (lifecycle, uncaught exceptions).
- [x] One SDK client per process; no duplicate global handlers on re-consent.
- [x] Identity sync from SDK persisted state; no cross-user person linking.
- [x] Calls before registration replayed, not dropped (#197).
- [x] Expo Router screen views by route pattern.
- [x] Handled failures reach Error Tracking with `error_source`.
- [x] History view: one event per read, not one per cached Submission.

**Out of scope / not addressed:**

- Session replay, surveys, touch autocapture: privacy cost, no current need.
- Revenue/monetization events: app sells nothing.
- `docs/references/privacy-nutrition-labels.md` re-verification (see Follow-ups).
- Camera telemetry vocabulary cleanup (domain.md: do not extend).

## Intent

**Purpose:** analytics for this app serve stability and friction, not growth. Lost, duplicated or wrongly attributed events hide bugs; events after revocation break consent.

## Design decisions and reasoning

### Own the client instead of `PostHogProvider apiKey`

- **Decision:** `shared/analytics/posthogClient.ts` creates one `PostHog` lazily; `AppProviders` passes it as `client`. Revocation calls `optOut()`; re-consent calls `optIn()` on the same instance.
- **Reason:** `PostHogProvider` (4.63.0) builds a client in `useMemo` and never shuts it down. Unmounting on revocation left it running: lifecycle events and global exception handlers kept enqueuing and flushing. Each remount added another client and handler chain. Opt-out persists, so `openPostHogClient` always calls `optIn()`; the SDK's `wrap` orders it before any later enqueue.
- **Affected journey/state:** Settings analytics toggle off/on; consent version bump.

### Identity from SDK state

- **Decision:** `syncPostHogIdentity(posthog, uid)`, after `posthog.ready()`. Identified as someone else → `reset()` then `identify(uid)`. Anonymous → `identify(uid)` (merge). Signed out while identified → `reset()`. Device super properties re-registered after every reset.
- **Reason:** the old in-memory ref reset each launch. A launch restoring user A, then signing in B, called `identify(B)` with `$anon_distinct_id` already linked to A. `reset()` also dropped `device_model` etc. until the next mount.

### Pending queue, not a warning

- **Decision:** `captureEvent`/`captureException` enqueue (cap `MAX_PENDING_CAPTURES` = 50, oldest dropped) while unregistered; `registerCapture*` replays, re-checking `analyticsAllowed()`. `AnalyticsBridge` unregisters (null) on unmount. Revocation clears the queue.
- **Reason:** consent flips, then navigation fires events before the bridge's effect runs (#197). Cap bounds builds without PostHog configuration.

### Screen tracking

- **Decision:** SDK `captureScreens` off; `AnalyticsBridge` calls `posthog.screen(screenNameFromSegments(useSegments()))`. Groups and `index` dropped; dynamic segments stay as patterns (`/sighting/[id]`).
- **Reason:** the SDK tracker reads React Navigation route names, which repeat (`index`) under Expo Router. Patterns keep record ids out and group by screen. Screen views enable paths and funnels for friction.

### `reportError` for handled failures

- **Decision:** `reportError(source, error, extra?)` = `console.error(source, error)` + `captureException(error, { error_source: source, ...extra })`. Replaced 24 `console.error` sites on user-felt paths (submit, uploads, draft sync/restore, auth, consent permissions, library picker, camera capture/gallery save, history, map pins, email sync). `uploadNewPhoto` and `send.ts` finalize keep their console lines and add `captureException`; upload refusals carry `upload_refusal` and `upload_refusal_status`.
- **Reason:** these failures were invisible in PostHog; Error Tracking groups them with stacks. Console tags kept verbatim so log greps still work. Emulator-ping errors stay console-only (dev).

### `sighting_history_viewed` replaces `feral_reports_viewed`

- **Decision:** one event per history read (mount, refresh) with `sighting_count` and per-status counts; fires on empty history too.
- **Reason:** the old event fired once per cached Submission per read: N events per view, inflating volume and making "views" uncountable. New name so old and new series never mix.

## What shipped

- `src/shared/analytics/posthogClient.ts` — client lifetime, options, identity, device properties, screen names.
- `src/shared/analytics/analytics.ts` — pending queue, nullable registration, `reportError`, `SIGHTING_HISTORY_VIEWED`.
- `src/providers/AppProviders.tsx` — `client` prop, opt-out effect, identity and screen effects, `autocapture` off for screens/touches.
- `src/features/history/hooks/useFeralReports.ts` — one view event.
- 18 feature files — `console.error` → `reportError` / added `captureException`.

## Tests

| Test file                                                  | What it verifies                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/analytics/__tests__/posthogClient.test.ts`     | Real SDK: revoked client enqueues nothing, re-consent reuses it; B's sign-in after A carries neither A nor A's anon id; sign-out resets and keeps device props; screen names. |
| `src/shared/analytics/__tests__/analytics.pending.test.ts` | Pre-registration calls replay in order; revocation before registration drops them; cap keeps newest.                                                                          |

Mutation check: disabling the reset-before-identify and the opt-out fails three posthogClient tests.

**Not tested:**

- `AppProviders` wiring (`useSegments` → `screen`, `ready()` → identity): thin glue over tested functions; RootLayout tests mount it without consent.
- `reportError` call sites: one-line swaps; console tags unchanged.

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`
- [x] Unit/model tests: `npx jest` (150 suites, 707 tests)
- [x] Lint: `npx eslint` on changed files
- [x] Formatting: `npx prettier --write` on changed files

**Unverified:**

- No device or release-candidate build; no events observed in a PostHog project.
- SDK flush against MSW took 10 s per request in Jest; tests avoid flushing rather than diagnose it.

## Follow-ups and known limitations

- [x] Re-verify `docs/references/privacy-nutrition-labels.md`: it predates `identify(uid)` (pre-existing) and lists 10 events; screen views and `error_source` now ship.
- [ ] PostHog dashboards/insights using `feral_reports_viewed` must move to `sighting_history_viewed`.
- [ ] #197: the queue fixes the drop; the issue can close after a device check.

## Implementation updates

### 2026-11-25 — fix

**Purpose:** the store labels said analytics was "Not Linked"; `identify(uid)` makes it linked. Paths and data types were stale.
**Change:** rewrote `docs/references/privacy-nutrition-labels.md` against current code (analytics linked and optional, Library pick reads photos, name and email-updates rows, service-provider sharing, deletion open item). Updated the `shared/` map in `docs/PROJECT_STRUCTURE.md`.

## 2026-11-25 — PR review fixes

**Purpose:** Apply the active account’s analytics choice to SDK requests and keep handled error details out of telemetry.

**Change:** SDK registration waits for identity. Revocation or an account switch clears queued captures. The SDK transport checks current consent and identity before sending. Handled errors keep their original details in the local log and send a source label with a call-site stack to Error Tracking. The store-label mapping includes PostHog’s app-install identifier. [Consent review fixes](2026-11-25-consent-records.md#2026-11-25--pr-review-fixes)

## 2026-11-25 — fix (owner review of 1d1647b)

**Purpose:** A retried batch could cross an account switch; sign-out left the last UID in SDK storage; history counts included other accounts; SDK tests left flag work running after Jest teardown.
**Change:** Each request belongs to the consent session of its first attempt (keyed by its headers object, which the SDK reuses on retries); `closePostHogClient` ends the session. `forgetSignedOutIdentity` runs on a reported sign-out. `sighting_history_viewed` counts `ownSightings` and drops reads that outlive an account switch. Identity tests disable remote flags. Tests: `posthogClient.test.ts` (retry across a switch, sign-out identity), `AppProviders.signOut.test.tsx`, `useFeralReports.analytics.test.ts`. Mutation: removing the session check fails the retry test.
