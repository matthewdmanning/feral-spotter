# Emulators and On-Device Testing

This is the authoritative document for **test drives** -- tesing app functionality using emulators or physical devices. This document does not address testing code, such as jest.

## Documenting Test Drives

Reports must be filed under `emulator`. Any screen captures must be saved to `emulator`/`screen-captures`. Logs must be saved to a session unique file under `emulator`/`logs`. All files must follow project file format specifications.

## Every emulator run

Check that PostHog analytics only fires with consent (unchecking analytics-consent must prevent `PostHogProvider` from mounting — no `posthog`/`[analytics]`/`captureEvent(`/`captureException(`/`fireAnalyticsEvent` in logcat) and that GPS/location capture is actually firing (`startLocationCapture`/`[location]`/`FusedLocationProvider`/`GnssLocationProvider`/`LocationManagerService`/`watchPositionAsync`). Write findings to a dated file in `emulator/run-notes/` (create the folder on first use). Every file written or updated during an emulator run — run-notes, punchlists, any other working doc — must record the git state it was tested against (`git rev-parse HEAD` + `git branch --show-current`) near the top.

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
