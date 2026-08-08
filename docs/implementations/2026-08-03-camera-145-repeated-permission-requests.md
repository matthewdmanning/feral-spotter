# Sprint:camera — #145 repeated permission requests on every shutter press (2026-08-03)

Implements #145, part of #144 (Camera flow: user-test-drive UI fixes,
2026-08-02), first sprint per
`docs/planning/2026-08-03-punchlist-triage-sprints.md`. Branch
`issue-144-camera`, off fresh `origin/main` (`4546fae`). Code complete
**and verified on-device** (Pixel_6_-_API_35 emulator).

## What shipped

`useCameraCapture.tsx`'s `handleTakePhoto` used to `check()` then
conditionally `request()` the media-library permission inline, on every
capture. If status stayed non-terminal (denied-but-askable), `request()`
re-fired on every press — a regression of the already-closed #48. Fixed by
moving the `request()` call into a dedicated mount effect (fires once per
camera-screen session); the shutter path now only ever `check()`s and
skips the gallery save if not yet granted, rather than re-prompting.

## Branch correction mid-session

Work started on `chore-emulator-tap-scripts` (already-merged PR #143,
19 commits behind `origin/main`) before being moved to a fresh
`issue-144-camera` branch off `origin/main` per this repo's branching
convention — stashed the two in-progress source edits, branched, popped.

## Tests written

`src/hooks/__tests__/useCameraCapture.test.ts`: new case asserting two
shutter presses with a still-`denied` status call `requestPermissionsAsync`
exactly once (from the mount effect, not per capture) — regression guard
for the call-count part of #145. The same test also asserts the call is
`writeOnly=true`, which is the #146 fix (see that issue's notes) — the two
were fixed together and share this one test.

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests), `tsc
--noEmit`, `expo lint` (0 errors, pre-existing require()-in-tests
warnings only), `scripts/format-changed.mjs --check` against
`origin/main`.

**Run on-device** (Pixel_6_-_API_35 emulator — the same AVD #140/#146
were originally filed on) via the existing dev-client APK (no native
rebuild needed, JS-only change) and the repo's `emulator/tap_*.py`
helpers: two shutter presses in the same camera session produced no
repeated permission-prompt/picker interruption (`dumpsys activity
activities`'s `topResumedActivity` stayed
`com.mmanning.feralspotter/.MainActivity` throughout both presses) and
both captures still saved (two new `content://media/external/images/media`
rows, in-app badge went `Done (1)` → `Done (2)`) — confirming the
mount-effect-only request doesn't cost repeat captures their gallery
save. This on-device run is shared with #146 (same walkthrough, same
root-cause fix); see that issue's notes for the picker-specific evidence.
