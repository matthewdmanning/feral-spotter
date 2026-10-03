# Emulator run notes — 2026-08-02

Git state: branch `ci-security-and-commitlint-checks`, commit `5dcd4fa720054337d3a18916483b8c0a0946e891`.

## Analytics consent gating

Unchecked the analytics-consent box (consent-store: `accepted: true, acceptedVersion: 1, analyticsAccepted: false`).

Result: correct. `AppProviders.tsx` never mounts `PostHogProvider` when `analyticsAccepted` is false, so the SDK doesn't load at all — no automatic session capture, no `fireAnalyticsEvent`/`captureEvent`/`captureException` calls, nothing in logcat matching `posthog|[analytics]|captureEvent(|captureException(|fireAnalyticsEvent`. Consent gate holds.

## Media consent — "Don't allow"

Clicking "Don't allow" on the media-library consent prompt immediately exits the app — no warning, unprompted. Logged on punchlist (`docs/planning/2026-08-02-ui-bug-punchlist.md`, item 9) as a bug: should route back to Home with a pop-up instead. Possibly overlaps open issues #66 (any camera consent selection treated as denial) and #101 (unhandled exception in consent's permission-request chain silently strands the user).

## GPS/location firing

Monitored logcat for `startLocationCapture|[location]|FusedLocationProvider|GnssLocationProvider|LocationManagerService|watchPositionAsync` across this session's runs — no confirmed firing event captured yet (camera-open → GPS-start path, issue #128, still unverified live).
