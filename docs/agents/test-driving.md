# Emulators and On-Device Testing

This is the authoritative document for **test drives** — testing app functionality using emulators or physical devices. This document does not address testing code, such as Jest.

## Documenting Test Drives

Reports must be filed under `docs/test-drives`. Any screen captures must be saved to `docs/test-drives/screen-captures`. Logs must be saved to a session unique file under `docs/test-drives/logs`. All files must follow project file format specifications.

## Before launching the app

1. Choose the [build type](builds.md#local-builds) and follow the
   [Firebase setup and connection checks](backend.md#test-drive-posture-emulator-by-default).
   Use the emulator suite for routine drives.
2. Start with fresh app data for onboarding, first-run permission prompts, or
   changed camera defaults. `npm run android` preserves app data, and saved
   settings take precedence over build defaults. To reset a disposable Android
   test installation, use `adb -s <serial> shell pm clear com.mmanning.feralspotter`.
   This erases that installation's local app data, including drafts.
3. For a USB-connected Android device that cannot reach Metro over LAN, run
   `adb -s <serial> reverse tcp:8081 tcp:8081` and open
   `http://localhost:8081` in the dev client. The backend guide lists the
   additional ports for Firebase.
4. Enable Firebase debug logging as described below. Use the
   [Android drive tools](../../emulator_tools/) to inspect the screen and
   interact with the app.

## Every emulator run

Check that PostHog analytics only fires with consent (unchecking analytics-consent must prevent `PostHogProvider` from mounting — no `posthog`/`[analytics]`/`captureEvent(`/`captureException(`/`fireAnalyticsEvent`). **Note the channel:** these calls surface in Metro's JSONL log (`.expo/dev/logs/start.log`, `metro:client_log` entries), not in `adb logcat` — `logcat` will show nothing even when the check is failing. Also check that GPS/location capture is actually firing (`startLocationCapture`/`[location]`/`FusedLocationProvider`/`GnssLocationProvider`/`LocationManagerService`/`watchPositionAsync`) — this one genuinely is in `logcat`, unfiltered (not pid-scoped — the location provider logs come from system processes, not the app's own pid). Write findings to a dated file in `docs/test-drives/run-notes/` (create the folder on first use). Every file written or updated during an emulator run — run-notes, punchlists, any other working doc — must record the git state it was tested against (`git rev-parse HEAD` + `git branch --show-current`) near the top.

## Permission and consent prompts

Follow the scenario's expected choice for each prompt. For a happy-path drive
on a test device or account, accept the app's consent steps and grant the
Android permissions needed by the scenario.

- Exercise the app's consent screens and Android's permission dialogs with
  [the drive tools](../../emulator_tools/) or touch input. Granting permissions
  through `adb shell pm grant` bypasses the dialogs.
- For analytics coverage, verify the absence of events before consent, then
  test opt-in or opt-out as the scenario requires.
- Ask the user when a prompt needs their credentials or a choice outside
  the test scenario.

## Before every physical-device/emulator run: enable Firebase debug logging

Native Firebase SDK logs (Storage, Auth) are silent by default — a failed
`putFile` can produce zero logcat output even when it never reached the
network. Set these before driving (resets on device reboot, not
persistent):

```
adb shell setprop log.tag.FirebaseStorage DEBUG
adb shell setprop log.tag.FirebaseAuth DEBUG
adb shell setprop log.tag.FirebaseApp DEBUG
```

## Device/environment notes (accumulated from test-drive sessions)

- Metro must run with `CI=1` on Windows dev machines — without it, Metro's
  file watcher can hang indefinitely on startup (reproduced 3x in one
  session, 2026-08-09, root cause unresolved). `CI=1` disables Fast
  Refresh, so code changes need a fresh `npm run android` / Metro restart
  to see, not a reload.
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
- Take a screenshot when the success criteria is itself visual appearance
  (not just "does this element exist / not crash"). Save to
  `docs/test-drives/screen-captures/`, filename
  `YYYY-MM-DD_appearance-question.png`.
