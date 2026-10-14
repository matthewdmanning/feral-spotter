# Camera Seam Review — Stage 3: Maintainability and Tests

Branch: `feat-camera-capture-stack`
Date: 2026-09-27
Scope: `useCameraCapture` (legacy VisionCamera), `useNativeCameraCapture`, the switch in `src/screens/camera/index.tsx`, `modules/native-identification-camera` (Kotlin + Swift), `modules/ios-camera-optimizer`.

Stage 1 (correctness) is filed as issue #385. Stage 2 (performance) is not yet filed.

Framework selection is out of scope. Every item below is about the code as written.

---

## 1. Duplication

Is it more likely someone managed to write hundred of lines of identical code or incompletely refactored?

### 1.1 The exposure-cap heuristic exists twice — highest risk in the diff

| Copy | Location                                                                                |
| ---- | --------------------------------------------------------------------------------------- |
| A    | `modules/native-identification-camera/ios/NativeIdentificationCameraView.swift:317-346` |
| B    | `modules/ios-camera-optimizer/ios/IosCameraOptimizerModule.swift:92-129`                |

A bad merge caused`motionPreservingExposureCap` and its `isUsableDuration`. Both pick the smaller of the system cap and the minimum frame duration, then clamp to the active format's `minExposureDuration` and `maxExposureDuration`. The two copies are written differently — copy A uses `candidate.map { ... } ?? frameDuration`, copy B uses an `if`/`else` — and currently agree.

Why this one matters most: it is the only tuned numeric heuristic in the diff, it has no test, and it has no comment. When one copy is adjusted the other will silently keep the old behavior, and the two iOS paths will diverge in exactly the condition the heuristic exists for.

Extract to one shared Swift file in the module both can depend on.

### 1.2 The two capture hooks duplicate about 150 lines

`src/hooks/useCameraCapture.tsx` (426 lines) and `src/hooks/useNativeCameraCapture.tsx` (333 lines) both contain:

- `AppState` subscription plus `useIsFocused` combined into `isActive`
- the flash-overlay shared value and `useAnimatedStyle`
- `cycleFlash`, `flipCamera`, `handleDone`, `handleClose`, `handleDiscardPhoto`
- `renderItem`, `keyExtractor`, and the `scrollToEnd` effect
- the `CAMERA_OPENED` event plus `startLocationCapture` mount effect
- the `gallerySavePermission.request()` effect
- the whole build-submission, `addPhoto`, `setCapturedPhotos`, `uploadNewPhoto`, `Asset.create` block

This is not theoretical drift. It has already happened: the once-only device-ready guard `hasReportedInitialDevice` exists in `useCameraCapture.tsx:347` and has no counterpart in the native hook, which is Stage 1's duplicate-telemetry finding.

Every fix to the shared workflow currently has to be applied twice, and there is nothing that fails when it is applied once.

### 1.3 The two screens duplicate the chrome

`LegacyCameraScreen.tsx` and `NativeCameraScreen.tsx` share the permission gate, the top bar, the thumbnail strip, the shutter row, the shutter press animation, and `index.styles.ts`. Same drift pattern: `accessibilityLabel` appears twice in the legacy screen and zero times in the native one.

---

## 2. Observability vocabulary has forked

The stated purpose of the telemetry is comparing backends. The field names prevent it.

| Concept            | Legacy path emits                                                                   | Native path emits                            |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| Which pipeline ran | `capture_pipeline`: `legacy` / `improved` / `ios_identification`                    | `capture_backend`: `native`                  |
| Which variant ran  | `camera_variant`: `tap_single`, `device_aware_burst`, `ios_identification_single` … | `camera_variant`: `native` (constant)        |
| Which framework    | `camera_backend`: `visioncamera`                                                    | `camera_backend`: `avfoundation` / `camerax` |

Three problems:

1. **Two field names for one concept.** `capture_pipeline` and `capture_backend` both answer "which path ran." A query cannot span both.
2. **A dimension collapsed to a constant.** `camera_variant` carries real information on the legacy path and none on the native path.
3. **One field, two taxonomies.** `camera_backend` mixes a JavaScript library name with native framework names.

Pick one field name per concept and use real values on both paths.

---

## 3. Configuration surface

Eight booleans in `src/hooks/useSettingsStore.ts:14-21` govern three code paths:

```
improved_camera_capture            ios_improved_camera_capture
camera_performance_checks          native_camera_capture
camera_max_detail                  camera_motion_priority
camera_disable_low_light_boost     camera_subject_metering
```

- **Mixed default polarity.** Some are read as `!== false` (default true), others as `=== true` (default false). Commit `4e3a2cf fix(camera): preserve false defaults in settings` already had to correct this once.
- **Inverted naming.** `camera_disable_low_light_boost` names the negative while the legacy path's `enableLowLightBoost` names the positive. The same hardware feature is expressed in opposite polarity in the two paths.
- **Opaque names.** `maxDetail` and `motionPriority` do not say what they change. `motionPriority` alone selects a CameraX capture mode and a frame-rate range on Android, and sets zero-shutter-lag, fast-capture prioritization, and an exposure cap on iOS. One name, five effects, split across two languages. The project's naming convention is descriptive-first; these are not.
- **No document states which combinations are valid.** Nothing records that `ios_improved_camera_capture` becomes dead once `native_camera_capture` is on, for example.

---

## 4. Documentation

There is not one explanatory comment in either native view about why any capture setting was chosen.

The one comment that does exist is good and shows the standard the rest does not meet — `IosCameraOptimizerModule.swift:53-55`:

```
// The active format may have changed since optimization was applied.
// Resetting to AVFoundation's current-format default is safer than
// restoring a duration captured under a different format.
```

Every non-obvious native setting deserves that treatment, because none of it is recoverable from the code.

`src/lib/camera/pipeline.ts` declares `ImagePostprocessor` (one optional consumer that nothing ever passes) and `SubjectLocalizer` (no implementation, no caller). Both are forward-looking, which is fine, but nothing in the file or the repo says so.

---

## 5. Type safety

`modules/native-identification-camera/src/types.ts:37` declares `style?: unknown`. This is the one prop React actually needs and it has no type. Both screens pass `RNStyleSheet.absoluteFill` into it, so the type is knowable. Use `StyleProp<ViewStyle>`.

---

## 6. Tests

### What exists

| File                                                                      | Covers                |
| ------------------------------------------------------------------------- | --------------------- |
| `src/hooks/__tests__/useCameraCapture.test.ts`                            | legacy hook           |
| `src/hooks/__tests__/useCameraCapture.controls.model.test.ts`             | legacy controls model |
| `src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx` | permission gate       |

### What has no test at all

- `useNativeCameraCapture` — the entire native orchestration hook
- `NativeCameraScreen`
- the backend switch in `src/screens/camera/index.tsx`
- `useIosIdentificationCapture`
- both native modules, in both languages

### The one test worth writing first

A single set of assertions run against **both** backends, checking the shared photo contract:

- `width` and `height` are greater than zero
- `captured_at` is present and is the shutter instant
- `uri` is a readable `file://` path
- the same prop pair produces the same documented behavior

That one test holds Stage 1 findings 3, 4, and 6 permanently, and it is the only kind of test that makes the duplication in section 1.2 safe.

Per `docs/agents/testing.md` the project uses model-based and stateful-flow tests. No model currently covers backend selection, which is the highest-branching decision in the feature.

---

## 7. Continuous integration

`.github/workflows/` contains `ci.yml`, `claude.yml`, `codeql.yml`, `commitlint.yml`. None of them runs `gradlew`, `xcodebuild`, `expo prebuild`, `ktlint`, or `swiftlint`.

Consequence: roughly 970 lines of Kotlin and Swift are validated only by whoever last built locally. The branch history contains two commits removing a temporary typecheck workflow, so this was noticed and not resolved.

Compounding it, `modules/native-identification-camera/android/build.gradle` sets:

```
lintOptions {
  abortOnError false
}
```

Android lint failures are ignored inside the module, and no CI job runs lint from outside it. Nothing checks the Kotlin.

Suggested split, matching the project's fast-versus-expensive rule:

| Stage             | Add                                                                        |
| ----------------- | -------------------------------------------------------------------------- |
| Pull request      | Kotlin compile, `ktlint`, `swiftlint`, and the both-backends contract test |
| Main or scheduled | `expo prebuild` plus a full Android and iOS build                          |

---

## Summary

| Area          | State                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Duplication   | One tuned heuristic duplicated across modules; about 150 lines duplicated across the two hooks; chrome duplicated across the two screens |
| Observability | Field vocabulary forked between paths; one dimension is a constant                                                                       |
| Configuration | Eight booleans, mixed default polarity, inverted naming, no validity document                                                            |
| Documentation | No rationale comments on any native setting                                                                                              |
| Types         | The one prop React needs is `unknown`                                                                                                    |
| Tests         | Native path, switch, and both native modules have zero coverage                                                                          |
| CI            | No job compiles or lints either native module; module lint is set not to fail                                                            |

The single highest-leverage item is the both-backends contract test in section 6. It is the only thing here that prevents the duplication in section 1 from producing new defects, and it retires three Stage 1 findings at once.
