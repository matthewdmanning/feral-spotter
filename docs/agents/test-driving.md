# Emulators and On-Device Testing

This is the authoritative document for **test drives** -- tesing app functionality using emulators or physical devices. This document does not address testing code, such as jest.

## Documenting Test Drives

Reports must be filed under `docs/test-drives`. Any screen captures must be saved to `docs/test-drives/screen-captures`. Logs must be saved to a session unique file under `docs/test-drives/logs`. All files must follow project file format specifications.

## Every emulator run

Check that PostHog analytics only fires with consent (unchecking analytics-consent must prevent `PostHogProvider` from mounting — no `posthog`/`[analytics]`/`captureEvent(`/`captureException(`/`fireAnalyticsEvent`). **Note the channel:** these calls surface in Metro's JSONL log (`.expo/dev/logs/start.log`, `metro:client_log` entries), not in `adb logcat` — `logcat` will show nothing even when the check is failing. Also check that GPS/location capture is actually firing (`startLocationCapture`/`[location]`/`FusedLocationProvider`/`GnssLocationProvider`/`LocationManagerService`/`watchPositionAsync`) — this one genuinely is in `logcat`, unfiltered (not pid-scoped — the location provider logs come from system processes, not the app's own pid). Write findings to a dated file in `docs/test-drives/run-notes/` (create the folder on first use). Every file written or updated during an emulator run — run-notes, punchlists, any other working doc — must record the git state it was tested against (`git rev-parse HEAD` + `git branch --show-current`) near the top.

## Device/environment notes (accumulated from test-drive sessions)

- Metro must run with `CI=1` on Windows dev machines — without it, Metro's
  file watcher can hang indefinitely on startup (reproduced 3x in one
  session, 2026-08-09, root cause unresolved). `CI=1` disables Fast
  Refresh, so code changes need a fresh `npm run android` / Metro restart
  to see, not a reload.
- `EXPO_PUBLIC_AUTH_MOCK=true` in local dev envs — sign-in/profile behavior
  during manual testing is mocked, not production auth. Check `.env.local`
  before trusting any auth-flow observation as representative.
- Screen-state verification technique: `adb shell uiautomator dump` +
  `adb pull` (prefix with `MSYS_NO_PATHCONV=1` in git-bash, or
  `/sdcard/...` paths get mangled into Windows paths), parse
  `text="..."`/`content-desc="..."` attributes, tap the center of the
  nearest `bounds="[x1,y1][x2,y2]"`. Do **not** use `dumpsys activity`'s
  `mFocusedApp`/`topResumedActivity` to claim which _screen_ is showing —
  it only proves which native Activity has focus, and Expo/RN hosts every
  JS route in one Activity (confirmed the hard way: an agent misread this,
  closed [#66](https://github.com/matthewdmanning/feral-spotter/issues/66),
  had to reopen it).
- (Established 2026-08-09, Pixel 7 physical device, branch `main` @
  `780da4606c396fbdb5fbe7752c189a72aedbfe1a`.)
