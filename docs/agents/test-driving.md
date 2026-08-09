# Emulators and On-Device Testing

This is the authoritative document for **test drives** -- tesing app functionality using emulators or physical devices. This document does not address testing code, such as jest.

## Documenting Test Drives

Reports must be filed under `emulator`. Any screen captures must be saved to `emulator`/`screen-captures`. Logs must be saved to a session unique file under `emulator`/`logs`. All files must follow project file format specifications.

## Every emulator run

Check that PostHog analytics only fires with consent (unchecking analytics-consent must prevent `PostHogProvider` from mounting — no `posthog`/`[analytics]`/`captureEvent(`/`captureException(`/`fireAnalyticsEvent` calls in Metro's log) and that GPS/location capture is actually firing (`startLocationCapture`/`[location]`/`FusedLocationProvider`/`GnssLocationProvider`/`LocationManagerService`/`watchPositionAsync`). Write findings to a dated file in `emulator/run-notes/` (create the folder on first use). Every file written or updated during an emulator run — run-notes, punchlists, any other working doc — must record the git state it was tested against (`git rev-parse HEAD` + `git branch --show-current`) near the top.

If `EXPO_PUBLIC_POSTHOG_KEY` isn't set, `PostHogProvider` never mounts and every analytics check above is vacuously true — a `[analytics] disabled — EXPO_PUBLIC_POSTHOG_KEY not set` warning logs on startup in dev builds so this isn't mistaken for a real bug (#201).

## Where JS console output actually lands (not logcat)

`console.log`/`console.warn` calls in app code (`[analytics]`, `[location]`, `[nav]`, etc.) do **not** reliably reach `adb logcat`'s `ReactNativeJS` tag on this project — confirmed 2026-08-09 (#201) after a session found genuinely-firing `[location]`-tagged logs invisible to logcat despite permissions and location services both confirmed on. Check **Metro's JSONL log** (`.expo/dev/logs/start.log`) for anything the app itself logs via `console.*`. Reserve `adb logcat` for native/system signals: uncaught JS/native crashes (`AndroidRuntime`), `System.err`, and app-lifecycle events (`ActivityManager`) — see below.

## Monitoring a physical-device run

`bash scripts/device-monitor.sh` (or `npm run device-monitor`) resolves the app's current pid (`adb shell pidof com.mmanning.feralspotter`), streams pid-scoped `AndroidRuntime`/`System.err`/`ReactNativeJS` plus package-scoped `ActivityManager` logcat lines, and automatically re-resolves the pid after an app restart (a plain hand-rolled filter breaks silently here, since pid changes on every relaunch). Combine with the Metro JSONL log above for full coverage — this script alone will not show JS-side `console.*` output.

**Screen-transition trail**: a dev-only `[nav] <pathname>` log fires on every route change (`ScreenTransitionLogger` in `src/providers/AppProviders.tsx`, mounted unconditionally in dev builds — no network, no PII, so it isn't gated behind analytics consent). Decided (#201) in favor of this thin `usePathname()` wrapper over wiring existing analytics calls to also log in dev: it needs no per-call-site changes and covers every route, not just ones with an existing analytics event. Read it from Metro's JSONL log, same as the other JS-side tags above — not logcat.

## Getting a no-EXIF photo onto the test device

Some flows (e.g. Library Pick's Manual-time fallback, #224) need a photo with
no EXIF `DateTime` tag on the device's photo library — not something you can
exercise from jest, since `expo-image-picker` does the actual EXIF read
natively and hands the app a plain JS object. Don't hunt for one online:
generating a fixture locally is faster, license-free, and reproducible.

`emulator/push_no_exif_fixture.py` does this end to end:

```console
python emulator/push_no_exif_fixture.py
```

It generates a small JPEG via Pillow with `exif=b""` (no EXIF segment at
all — not just a blank `DateTime`), pushes it to
`/sdcard/Pictures/FeralSpotterTest/` on the connected device, and fires a
`MEDIA_SCANNER_SCAN_FILE` broadcast so it's indexed and shows up in the
system Photo Picker / "Choose from Library" right away. The generated local
`.jpg` is a throwaway build artifact, not a fixture to commit — the script
regenerates it each run.
