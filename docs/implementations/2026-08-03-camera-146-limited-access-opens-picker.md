# Sprint:camera — #146 "Limited access" opens the library picker unexpectedly (2026-08-03)

Implements #146, part of #144 (Camera flow: user-test-drive UI fixes,
2026-08-02), first sprint per
`docs/design/2026-08-03-punchlist-triage-sprints.md`. Branch
`issue-144-camera`, off fresh `origin/main` (`4546fae`). Code complete
**and verified on-device** (Pixel_6_-_API_35 emulator).

## What shipped

Root cause was one level deeper than #145: the app was gating a
_write-only_ operation (`Asset.create`, saving a newly captured photo)
behind `react-native-permissions`' `READ_MEDIA_IMAGES` — a full read
permission. On Android 14+, that permission's grant flow includes a
"Select photos…" option that itself launches the system Photo Picker
(`ACTION_PICK_IMAGES`), which is what was hijacking the Camera screen
(shared root cause with the already-filed #140). `app.json` already had a
dedicated `savePhotosPermission` string configured for
`expo-media-library`'s config plugin — the code just wasn't using that
API. Switched both the mount effect and the shutter-path check from
`react-native-permissions`' `check`/`request(PERMISSION_MAP.mediaLibrary)`
to `expo-media-library`'s own `getPermissionsAsync(true)` /
`requestPermissionsAsync(true)` (`writeOnly`), which requests add-only
access and has no read-permission "Select photos" flow to surface. This
also narrows the shutter-path accept condition from `GRANTED || LIMITED`
to `GRANTED` only, since `writeOnly` responses have no `LIMITED` state.

## Root-cause pivot mid-implementation

First pass just moved the existing `request()` call from the shutter path
to the mount effect — same `READ_MEDIA_IMAGES` permission, same
picker-flow risk, just relocated within the same screen. Advisor review
caught that this was a no-op against #146's actual complaint (picker
still surfaces on the Camera screen, just once instead of repeatedly) and
flagged the mismatch between a write-only operation and a full-read
permission as the real lead. Confirmed via Context7 (`expo-media-library`
docs) that `requestPermissionsAsync`/`getPermissionsAsync` take a
`writeOnly` param, and via `app.json` that the config plugin's
`savePhotosPermission` was already set up for exactly this — the switch
closed #146 at the root instead of relocating the symptom.

## Tests written

`src/hooks/__tests__/useCameraCapture.test.ts`: the same new case as
#145's regression guard also asserts `requestPermissionsAsync` is called
with `writeOnly=true` — the #146-specific part of that test. `expo-media-library`'s
mock in this test file gained `getPermissionsAsync`/`requestPermissionsAsync`/
`PermissionStatus` exports (previously only `Asset.create` was mocked) —
needed since the fix moved off `react-native-permissions` entirely for
this path.

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests), `tsc
--noEmit`, `expo lint` (0 errors, pre-existing require()-in-tests
warnings only), `scripts/format-changed.mjs --check` against
`origin/main`.

**Run on-device** (Pixel_6_-_API_35 emulator — the same AVD #140/#146
were originally filed on) via the existing dev-client APK (no native
rebuild needed, JS-only change) and the repo's `emulator/tap_*.py`
helpers, walking the full first-run chain (intro-flow → mocked Google
sign-in → analytics-consent → consent → camera):

- `dumpsys activity activities`'s `topResumedActivity` stayed
  `com.mmanning.feralspotter/.MainActivity` through camera-screen open
  and two shutter presses — no Photo Picker activity ever took the
  foreground.
- `dumpsys package` confirmed `READ_MEDIA_IMAGES` and
  `READ_MEDIA_VISUAL_USER_SELECTED` both stayed `granted=false` the
  entire session — the read permission that used to drive the picker
  flow was never touched.
- Two shutter presses produced exactly two new
  `content://media/external/images/media` rows
  (`VisionCamera_*.jpg`), with `date_added` timestamps matching the tap
  times — confirms `Asset.create` still saves to the gallery under the
  new `writeOnly` gating (no functional regression from narrowing
  `GRANTED || LIMITED` down to `GRANTED`).
- In-app capture-count badge (`Done (1)` → `Done (2)`) confirmed the JS
  capture path itself was unaffected.

## Not addressed this sprint

`PERMISSION_MAP.mediaLibrary` (`src/lib/permissions.ts`) is now unused —
no other call site references it after this change. Left in place
(iOS's `PHOTO_LIBRARY_ADD_ONLY` mapping is still semantically fine, and
removing a map entry is out of scope for a permission-request-path fix)
rather than deleted; worth a look in a follow-up cleanup pass if it stays
unused.
