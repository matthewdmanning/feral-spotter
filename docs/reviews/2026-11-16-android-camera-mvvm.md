# Android camera module: MVVM review

Reviewed 2026-11-16 on `review/android-camera-mvvm`, base `origin/main` `941aff9`. Line references (`:N`) point at `NativeIdentificationCameraView.kt` on that base.
Scope: `modules/native-identification-camera/android/src/main/java/…/*.kt` (7 files, 1,877 lines). Source read only; nothing compiled or driven.

## Basis

The Android contract comes from official guidance. Project docs only add local conventions.

- **UI logic vs business logic** ([State holders and UI state](https://developer.android.com/topic/architecture/ui-layer/stateholders#ui-logic-and-its-state-holder)):
  - Business logic implements product requirements on app data.
  - UI logic decides how state is shown and how the UI reacts to input.
  - Simple UI logic may live inline in the UI. When it grows complex, a plain-class state holder is recommended.
- **ViewModel placement** ([Views architecture recommendations](https://developer.android.com/topic/architecture/views/recommendations-views)): use screen-level ViewModels, not ViewModels inside reusable UI components.
- **This seam:**
  - `NativeIdentificationCameraView` is a reusable native component.
  - Its screen-level state holder is the JS layer (`useNativeCameraCapture`).
  - So an `androidx.lifecycle.ViewModel` in the view would go against the guidance. A plain-class state holder fits.
- **Local conventions:**
  - `native-code.md` §5: logic must be extracted into a pure class before a JVM test can reach it.
  - `domain.md`: camera seam and capture-tuning vocabulary.
  - Neither defines MVVM. A search of `docs/`, `src/` and `modules/` for "MVVM" / "view model" found nothing.

How findings are classed:

- **Defect**: demonstrated wrong behaviour, with evidence.
- **Recommendation**: a complexity or testability improvement. It is not a violation.
- **Withdrawn**: the claim didn't hold.

## Responsibility map

| File                                  | Lines | Responsibilities                                                                                                                                  | Assessment                                   |
| ------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `NativeIdentificationCameraModule.kt` | 107   | Binding: props → view fields; view-scoped async functions → view methods                                                                          | Fits                                         |
| `ViewZoom.kt`                         | 42    | UI-logic state: zoom value, limits, inverse mapping; tested                                                                                       | Fits                                         |
| `RawJpegSettlement.kt`                | 98    | Business logic: RAW+JPEG outcome; tested                                                                                                          | Fits                                         |
| `CaptureTuning.kt`                    | 109   | Business logic: priorities → capture mode, ZSL fallback                                                                                           | Fits                                         |
| `FieldCaptureConfig.kt`               | 283   | Business logic: specs, device capability, `resolve`; tested                                                                                       | Fits                                         |
| `CaptureSettings.kt`                  | 74    | Business logic: per-capture metadata                                                                                                              | Fits; untested                               |
| `NativeIdentificationCameraView.kt`   | 1,164 | UI logic (preview, zoom label, gestures, prop adaptation) + session lifecycle + capture orchestration + data operations (files, EXIF) + telemetry | Mixed: UI logic is fine; see F2 for the rest |

## Findings

### F1: withdrawn (false positive)

The original claim: `focus` and `setSubjectRegion` touch `PreviewView` off the main thread. That is wrong.

- A module-level `AsyncFunction` defaults to `Queues.DEFAULT`.
- Expo's [Module API reference](https://docs.expo.dev/modules/module-api/#asyncfunction-1) specifies the main queue for an `AsyncFunction` declared in a `View`. `expo-modules-core` 58.0.30 does the same: `ViewDefinitionBuilder.build()` calls `runOnQueue(Queues.MAIN)` for every view async function.
- `capture`, `focus` and `setSubjectRegion` are all view-scoped, so all three run on main.
- The view's comments claimed a caller's thread, and that misled the review. Those comments are corrected, and `@Volatile` is gone from `viewZoom` and the bound-session state.

### F2 (recommendation): move session lifecycle, capture orchestration and data operations out of the view

Evidence is complexity and missing tests, not a broken rule. The view holds three kinds of non-UI work:

1. Session lifecycle: deferred rebind coalescing, bind, unbind (`:220-227`, `:485-499`, `:608-735`). This is complex logic, so the Android guidance points to a plain-class state holder.
2. Capture orchestration: single vs RAW+JPEG path, settlement wiring, timeout (`:756-974`). This is business logic.
3. Data operations: temp-file creation, bitmap bounds decode, EXIF orientation, result assembly, DNG deletion (`:864-867`, `:989-1066`).

The UI logic can stay: preview implementation mode, zoom reset and label, gestures, tap mapping.

These behaviours have no test and can't get one in place (`native-code.md` §5):

- Rebind coalescing (provider callback vs prop batch, either order; one bind each).
- The EXIF quarter-turn → width/height swap.
- The frame-rate range choice (`maxWithOrNull` on lower, then upper).
- The focus-rejection reasons.

Proposal: see Target shape. The value is testability and a smaller view. There is no correctness gain to claim.

### F3 (recommendation, done): bound-session state as one value

Before this change, `boundSessionConfig`, `imageCaptureUseCase`, `camera`, `boundTuning`, `boundZslSupported`, `boundFieldConfig` and `boundFrameRateRange` (`:198-218`) were set one by one in `bindCamera` (`:662-668`) and cleared one by one in `unbindCamera` (`:721-728`). A field added later could be missed in either place.

- **Done:** `BoundSession.kt`.
  - One `var boundSession: BoundSession?`: bind assigns it once; unbind clears it.
  - `capture` snapshots it once per request.
  - The view's `runningCaptureMode` fallback to the live `tuning` is removed; it was unreachable.
- No runtime regression was found by source comparison. Needs a compile and a test drive.

### F4 (recommendation): small extractions in the capture setup

- Frame-rate range choice (`:599-601`): capture policy that sits outside `CaptureTuning`. Moving it there gives it a JVM test.
- The highest-resolution `ResolutionSelector` block is duplicated in `buildImageCapture` (`:504-512`) and `buildFieldImageCapture` (`:554-563`). Concrete cleanup: one `highResolutionSelector()` helper.
- Not findings: lens facing (`:619-625`, `:238`) and flash (`:772-776`) map prop strings onto CameraX constants. That is UI-logic adaptation and may stay inline. Extract it only if a test needs it.

### F5: withdrawn as an architecture finding; one open question

- `pinchZoom` switches `implementationMode` and resets the zoom inline (`:285-290`). That is UI logic, allowed inline.
- `disableLowLightBoost` calls camera control from its setter (`:276`). Setting it back to `false` doesn't re-enable boost. Bind never enables boost either, so this is a defect only if CameraX enables low-light boost by default. That default is not verified here. **Open question; needs device evidence.**

### F6 (recommendation, P3): typed payloads for the native contract

Event and result maps are built inline. `onCameraReady` uses camelCase keys (`requestedCaptureTuning`, `:679`), while `onCameraDiagnostic` uses snake_case (`requested_capture_tuning`, `:693`). With no Kotlin-side types, drift against `src/types.ts` goes unchecked.

- Proposal: typed payload data classes, each with one `toMap()`.
- `domain.md` marks this vocabulary "under review — do not extend", so don't rename keys.

## Target shape

```
Module (binding only)
  └─ View: PreviewView, zoom label, gestures, prop adaptation (UI logic)
       └─ CameraSessionController (plain-class state holder; main-thread confined)
            ├─ state: BoundSession? (one immutable value)
            ├─ apply(props), capture(opts), focus(pt)
            ├─ CaptureFileInspector: (w, h, exifOrientation) → reported size  [pure]
            ├─ CameraDiagnostics: payload builders                          [pure]
            └─ models: CaptureTuning, FieldCondition, RawJpegSettlement, ViewZoom, CaptureSettings
```

The controller takes `ProcessCameraProvider`, `LifecycleOwner` and an event sink as constructor dependencies. Its CameraX calls still need a device. Its decisions (rebind coalescing, settlement wiring, payloads) become JVM-testable behind a fake provider seam.

Suggested order, smallest first. Each step ships alone and needs a compile, plus a device drive where it touches CameraX:

1. F4: frame-rate choice into `CaptureTuning`, one `highResolutionSelector()`, with tests.
2. F3: `BoundSession` (done).
3. F2: extract `CameraSessionController` and the data-operation helpers.

## Verification

- Read every main-source Kotlin file in full.
- Read `expo-modules-core` `AsyncFunctionComponent`, `BaseAsyncFunctionComponent` and `ViewDefinitionBuilder` (58.0.30) for function queues.
- Not compiled. No JVM tests run. Not driven on a device.
