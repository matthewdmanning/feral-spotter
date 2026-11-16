---
title: Native camera audit fixes
tags:
  - implementation
  - camera
---

# Native camera audit fixes

**Scope:** fix
**Issues/spec:** #468, #470, #471, #472
**Date:** 2026-11-16
**Branch/PR:** issue-468-camera-audit-fixes

## Scope

**In scope:**

- [x] Record when the high-resolution configuration disables ZSL and report the resulting latency mode.
- [x] Preserve requested output format while recording delivered format, camera ID, and delivered dimensions.
- [x] Keep tap-owned and subject-owned focus actions independent, with observed completion diagnostics.
- [x] Correct field-capture comments so they do not promise unmeasured image-quality or low-light benefits.

**Out of scope / not addressed:**

- iOS implementation remains out of scope for this Android slice.
- Device capture, visual quality, latency, and focus behavior were not run here.

## Intent

**Purpose:** make native capture telemetry describe what CameraX actually delivered while keeping the existing capture-priority mapping and focus controls safe across asynchronous lifecycle changes.

## Design decisions and reasoning

### ZSL and high-resolution selection

- **Decision:** retain the requested `CaptureTuning` mapping and builder input, but label `DETAIL_AND_MOTION` as ZSL-disabled when its `PREFER_HIGHER_RESOLUTION_OVER_CAPTURE_RATE` configuration causes CameraX to fall back.
- **Reason:** this is a label-only audit fix: CameraX owns the fallback, while telemetry must distinguish requested tuning from the mode that ran.

### Focus ownership

- **Decision:** use a pure generation/owner state model and observe `startFocusAndMetering`'s future on the main executor.
- **Reason:** subject-region clears and disabling subject metering may cancel only subject-owned actions, while newer actions, unbind, and stale callbacks must not report completion for an obsolete request. The existing five-second tap auto-cancel behavior is preserved explicitly.

## What shipped

- `CaptureTuning` and capture diagnostics now expose `zsl_disabled_by_config`; ready events also report `zslDisabledByConfig`.
- Capture settings retain `output_format` and add settlement-time `delivered_format`, logical CameraX/Camera2 `camera_id`, and JPEG output `output_width`/`output_height`; a missing RAW/JPEG callback now arms the existing timeout after either file arrives.
- Focus completion, cancellation, and stale-action handling are guarded by `FocusActionOwnership`.
- LOW_LIGHT and FINE_DETAIL comments now describe latency tradeoffs without claiming sensor binning, noise reduction, or identification-quality guarantees.

## Tests

| Test file                                                                                                                        | What it verifies                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `modules/native-identification-camera/android/src/test/java/expo/modules/nativeidentificationcamera/CaptureTuningTest.kt`        | Configuration, flash, and unsupported-camera ZSL fallbacks.                          |
| `modules/native-identification-camera/android/src/test/java/expo/modules/nativeidentificationcamera/FocusActionOwnershipTest.kt` | Subject-vs-tap cancellation, newer-action staleness, and teardown invalidation.      |
| `modules/native-identification-camera/android/src/test/java/expo/modules/nativeidentificationcamera/RawJpegSettlementTest.kt`    | Existing RAW/JPEG callback ordering, timeout, and whole-request settlement behavior. |
| `src/features/camera-control/hooks/__tests__/useNativeCameraCapture.focus.test.ts`                                               | Forwards a subject clear while disabled and rejects a new subject region.            |

## Verification status

**Run and passing:**

- [x] JVM unit tests: `gradlew.bat :native-identification-camera:testDebugUnitTest --max-workers=2 --console=plain`
- [x] Native Kotlin compilation was included by the focused Gradle test task.
- [x] Focused hook regression: `useNativeCameraCapture.focus.test.ts` (red before the guard fix, green afterward).

**Unverified:**

- No emulator/device drive; CameraX's actual resolution fallback, delivered formats, camera ID, output dimensions, and focus future outcomes still need hardware evidence.

## Follow-ups and known limitations

- [x] The TypeScript caller forwards a null subject region even when subject metering is disabled; the focused hook regression covers the native ownership cancellation boundary.
- [ ] A device run should compare delivered dimensions and capture latency across the field conditions before treating any quality or low-light benefit as measured.
