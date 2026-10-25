---
title: Camera pinch zoom, full-field capture
tags:
  - implementation
  - camera
---

# Camera pinch zoom, full-field capture

**Scope:** fix
**Issues/spec:** requested directly by the project owner. The preview is too hard to see without zoom.
**Date:** 2026-10-24
**Branch/PR:** `fix/camera-pinch-zoom`

## Scope

**In scope:**

- [x] Android: pinch zoom that magnifies the preview only. The photo stays full field.
- [x] Pan, a map of the whole preview, and tap-to-focus that maps back through the zoom.
- [x] Zoom on by default and visible in every build.

**Out of scope / not addressed:**

- iOS. It keeps sensor zoom through `UIPinchGestureRecognizer`.
- Zoom buttons. A fallback if the touch path fails on a device.
- Sharper zoom from a higher preview resolution or a telephoto lens.

## Intent

**Purpose:** Let users see a distant cat, and still save the full field at full resolution.

## Design decisions and reasoning

### View zoom, not sensor zoom

- **Decision:** Scale the `PreviewView` on screen. Never call `setZoomRatio`.
- **Reason:** CameraX zoom crops every bound use case, including `ImageCapture`. The research is in the 2026-10-24 chat. Sources: the CameraX camera-controls docs, a CameraX forum thread, and ProAndroidDev.
- **Affected journey/state:** Camera screen, capture.
- **Related decision:** [[agents/ui-ux/current-state/camera-pinch-zoom]]

### PreviewView in COMPATIBLE mode while zoom is on

- **Decision:** `pinchZoom` true switches the `PreviewView` to COMPATIBLE (TextureView). False switches it back. Either change rebinds.
- **Reason:** The CameraX preview docs say COMPATIBLE mode allows scaling without restriction.

### Existing installs get zoom on through a migration

- **Decision:** The settings store is now version 1. Version 0 data gets `camera_pinch_zoom` set to true once.
- **Reason:** The old default (off) was saved with every other setting. Changing the default alone would not reach existing installs.
- **Cost:** A dev who turned zoom off on purpose before this change has it on again once.

## What shipped

- `NativeIdentificationCameraView.kt`: view zoom 1x to 5x, pan, `ZoomMapView`, focus mapping, COMPATIBLE mode switch, reset on unbind.
- The `pinch_ended` diagnostic now reports `view_zoom` and `sensor_zoom_ratio`. `sensor_zoom_ratio` should stay 1.0. That is the evidence the photo is full field.
- `camera_pinch_zoom` defaults to true. Its toggle is no longer dev-only.
- `useSettingsStore` migration, version 1.
- QA checklist items C6 to C9.

## Tests

**Model or flow covered:** Plain cases on a pure decision.

| Test file                                                | What it verifies                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/hooks/__tests__/useSettingsStore.migration.test.ts` | Version 0 data gets zoom on and keeps other settings. A later choice is kept. A new install is on. |
| `src/config/__tests__/photoToggles.invariant.test.ts`    | A release build shows the zoom toggle.                                                             |

**Not tested:**

- All Kotlin. There is no unit test lane for it, and I could not run a build.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`. No errors in `src/` or `modules/`.
- [x] Unit tests: `npx jest`. 82 suites, 373 tests.
- [x] Lint: `npx expo lint src __tests__ modules`. 0 errors.
- [x] Formatting: `npx prettier --check src modules/native-identification-camera/src`.

**Unverified:**

- [ ] Kotlin compile. No Android SDK in the session. The code is written but not built.
- [ ] Any device pass. This includes the touch path. The 2026-09-28 test-drive notes say the earlier fix was never driven on a device.
- [ ] That `PreviewView.getBitmap()` returns the unscaled, upright frame while the view is scaled. The map depends on it.
- [ ] That a tap still focuses and does not fire the shutter while zoomed.
- [ ] How soft the preview looks at 3x and 5x.
- [ ] CodeQL, security checks, and the Android build. These run in CI.

## Graveyard: pivots and corrections

### Sensor zoom was the first plan

- **Finding:** CameraX zoom crops the photo as well as the preview.
- **Impact:** Sensor zoom was dropped for the full-field requirement.
- **Resolution:** Kept as a possible later setting for users who accept a cropped photo.

## Follow-ups and known limitations

- [ ] Drive the touch path on a device. If it fails, add zoom buttons backed by a native `zoomRatio` prop.
- [ ] The map refresh grabs a full-size bitmap every 250 ms while zoomed. Replace it if it costs frames.
- [ ] Raise the preview resolution if the zoomed preview is too soft.
- [ ] iOS still crops the photo. Decide whether to match Android before iOS beta.
- [ ] The preview fills the screen with a center crop. The photo can show more than the preview at 1x. The map shows the preview's field, not the photo's.
- The 2026-09-28 run notes call pinch zoom "not a wanted feature". That decision is now reversed.

## Implementation updates

<!-- Append dated entries when modifying this feature after the initial implementation. -->
