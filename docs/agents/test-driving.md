# Emulators and On-Device Testing

This is the authoritative document for **test drives** -- tesing app functionality using emulators or physical devices. This document does not address testing code, such as jest.

## Documenting Test Drives

Reports must be filed under `emulator`. Any screen captures must be saved to `emulator`/`screen-captures`. Logs must be saved to a session unique file under `emulator`/`logs`. All files must follow project file format specifications.

## Every emulator run

Check that PostHog analytics only fires with consent (unchecking analytics-consent must prevent `PostHogProvider` from mounting — no `posthog`/`[analytics]`/`captureEvent(`/`captureException(`/`fireAnalyticsEvent` in logcat) and that GPS/location capture is actually firing (`startLocationCapture`/`[location]`/`FusedLocationProvider`/`GnssLocationProvider`/`LocationManagerService`/`watchPositionAsync`). Write findings to a dated file in `emulator/run-notes/` (create the folder on first use). Every file written or updated during an emulator run — run-notes, punchlists, any other working doc — must record the git state it was tested against (`git rev-parse HEAD` + `git branch --show-current`) near the top.
