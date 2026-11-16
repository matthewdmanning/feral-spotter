# Android camera module: MVVM review

Reviewed 2026-11-16 on `review/android-camera-mvvm`, base `origin/main` `941aff9`.
Scope: `modules/native-identification-camera/android/src/main/java/…/*.kt` (7 files, 1,877 lines). Source read only; nothing compiled or driven.

## Basis

No project doc defines MVVM. Searched `docs/`, `src/`, `modules/` for "MVVM" / "view model": no hits. Standard used:

- **Model**: domain state + policy; no Android `View`/`Context`; JVM-testable.
- **ViewModel**: owns screen/session state as one source of truth; exposes state + commands; holds no `View` references.
- **View**: renders state, forwards input; no policy, no I/O.

Repo rules applied: `native-code.md` §5 (extract logic into pure classes to test it); `domain.md` (camera seam, capture tuning).

Constraint: an Expo view has no `ViewModelStoreOwner`, so `androidx.lifecycle.ViewModel` doesn't fit. On this seam, JS hooks (`useNativeCameraCapture`) act as the screen ViewModel. Native MVVM here = a thin view over a plain-Kotlin session controller plus pure models.

## Layer map

| File                                  | Lines | Role today                                                                                                                       | Fit            |
| ------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `NativeIdentificationCameraModule.kt` | 107   | Binding: props → view fields, async functions → view methods                                                                     | Good           |
| `ViewZoom.kt`                         | 42    | Model: immutable zoom value, limits, inverse mapping; tested                                                                     | Good           |
| `RawJpegSettlement.kt`                | 98    | Model: RAW+JPEG settlement state machine; tested                                                                                 | Good           |
| `CaptureTuning.kt`                    | 109   | Model: priorities → capture mode, ZSL fallback rule                                                                              | Good           |
| `FieldCaptureConfig.kt`               | 283   | Model: specs, device capability, `resolve`; tested                                                                               | Good           |
| `CaptureSettings.kt`                  | 74    | Model: per-capture metadata map                                                                                                  | Good, untested |
| `NativeIdentificationCameraView.kt`   | 1,164 | View + ViewModel + data layer: rendering, gestures, session lifecycle, capture orchestration, file I/O, EXIF, telemetry, tracing | **Violates**   |

Summary: the models are clean, pure, and well tested. The view has absorbed every other layer.

## Findings

Ranked by severity. P1: correctness risk or blocks testability of core behaviour. P2: material layering gap. P3: cleanup.

### F1 (P1): `focus`/`setSubjectRegion` touch `PreviewView` off the main thread

`AsyncFunction` defaults to `Queues.DEFAULT` → `appContext.modulesQueue` (checked in `expo-modules-core` `AsyncFunctionComponent.dispatchOnQueue`). `focus` → `focusPreviewPoint` reads `previewView.width/height` and calls `previewView.meteringPointFactory` (`NativeIdentificationCameraView.kt:1117-1125`) on that background queue. `PreviewView` is a UI-thread class. `diagnostic(...)` also dispatches events from there. `capture` already hops to main via `post` (`:765`). Focus doesn't.

- Failure: the metering point is built from stale or torn layout state, or the call throws on stricter builds. A tap focuses the wrong spot, or fails without any visible sign.
- MVVM cause: there is no single owner of the threading rule. The view is both the UI object and the command handler.
- Fix: run `focus`/`setSubjectRegion` with `.runOnQueue(Queues.MAIN)` in the module, or `post` the body as `capture` does. Needs a device drive.

### F2 (P1): the view is a god object; session logic can't be unit-tested

`NativeIdentificationCameraView` mixes, in one class:

1. Rendering: `PreviewView`, zoom label, `onLayout`.
2. Input: the scale detector, `onInterceptTouchEvent`, tap mapping.
3. Session state machine: `needsRebind`, `rebindScheduled`, `applyPendingConfiguration`, `bindCamera`, `unbindCamera` (`:220-227`, `:485-499`, `:608-735`).
4. Capture orchestration: flash mapping, the single vs RAW+JPEG path, timeouts (`:756-974`).
5. Data layer: temp-file creation, bitmap bounds decode, EXIF orientation, result-map assembly (`:864-867`, `:989-1066`).
6. Telemetry: event-payload shaping, Perfetto sections, logcat (`:333-378`, throughout).

`native-code.md` §5 says new logic must be extracted into a pure class to be testable. Five behaviours here have no test and can't get one in place:

- The rebind coalescing rule (the provider callback and the prop batch can arrive in either order; one bind each).
- The EXIF quarter-turn → width/height swap.
- The flash string → mode mapping.
- The frame-rate range choice (`maxWithOrNull` on lower, then upper).
- The focus-rejection reasons.

Fix: see Target shape.

### F3 (P2): bound-session state is seven loose fields, not one value

`boundSessionConfig`, `imageCaptureUseCase`, `camera`, `boundTuning`, `boundZslSupported`, `boundFieldConfig` and `boundFrameRateRange` (`:198-218`) are set one by one in `bindCamera` (`:662-668`) and cleared one by one in `unbindCamera` (`:721-728`). Some are `@Volatile` and some aren't. The comments say which threads read them.

- MVVM cause: there is no single state object, so you can't snapshot the state or assert on it. A field added later can be missed in either place.
- Fix: use one immutable `BoundSession` data class, held in one `var boundSession: BoundSession?`. Bind assigns it once; unbind nulls it. Readers take one snapshot, as `focus` already does with `viewZoom`.
- **Status: fixed** on `refactor/android-camera-bound-session`, which adds `BoundSession.kt`. `capture` takes one snapshot per request. The view's `runningCaptureMode` fallback to the live `tuning` is gone: it was unreachable, because a capture without a bound session is rejected first. Needs a compile and a test drive.

### F4 (P2): policy lives in the view, not the model

- Lens facing: `position == "front"` → `LENS_FACING_*` (`:619-625`), and the normalisation in the `position` setter (`:238`).
- Flash: `"on"/"auto"/else` → `FLASH_MODE_*` (`:772-776`).
- Frame-rate range choice (`:599-601`). This is tuning policy, but it isn't in `CaptureTuning`.
- The highest-resolution `ResolutionSelector` block is duplicated in `buildImageCapture` (`:504-512`) and `buildFieldImageCapture` (`:554-563`).

Fix: move each into the model layer as a pure function (`CaptureTuning.chooseFrameRateRange(ranges)`, a `FlashMode.fromProp`, a `LensPosition.fromProp`). Keep one `highResolutionSelector()` helper. Each then gets a JVM test.

### F5 (P2): prop setters bypass the one configuration path

Most setters only set `needsRebind`, and `applyPendingConfiguration` applies the batch. Two act immediately:

- `disableLowLightBoost` calls camera control directly (`:276`). Setting it back to `false` does nothing until the next bind, and doesn't request one.
- `pinchZoom` switches `implementationMode` and resets the zoom inline (`:285-290`).

- MVVM cause: state flows two ways. Some changes go through the batch; others mutate the session from a setter.
- Fix: route every prop through the controller's `apply(props)`. Decide there what each change costs: rebind, a live control call, or view-only.

### F6 (P3): the native contract is string-typed, with mixed key casing

Props and options use raw strings (`position`, `flashMode`). Event and result maps are built inline, and `onCameraReady` uses camelCase keys (`requestedCaptureTuning`, `:679`) while `onCameraDiagnostic` uses snake_case (`requested_capture_tuning`, `:693`). `domain.md` marks the camera telemetry vocabulary "under review — do not extend". So this is not a rename request. The finding: payload shapes have no typed model on the Kotlin side, so drift against `src/types.ts` goes unchecked.

- Fix: typed payload data classes, or `Record`s, each with one `toMap()`. Don't rename keys until the vocabulary review ends.

## Target shape

```
Module (binding only)
  └─ View: PreviewView, zoom label, gestures; renders ViewZoom; forwards commands
       └─ CameraSessionController (plain Kotlin; main-thread confined)
            ├─ state: BoundSession? (one immutable value)
            ├─ apply(props), capture(opts), focus(pt)
            ├─ CaptureFileInspector: (w, h, exifOrientation) → reported size  [pure]
            ├─ CameraDiagnostics: payload builders                          [pure]
            └─ models: CaptureTuning, FieldCondition, RawJpegSettlement, ViewZoom, CaptureSettings
```

The controller takes `ProcessCameraProvider`, `LifecycleOwner` and an event sink as constructor dependencies. Its CameraX calls still need a device. Its decisions (rebind coalescing, settlement wiring, payloads) become JVM-testable behind a fake provider seam.

Suggested order, smallest first. Each step is independently shippable, and each needs a compile, and a device drive where it touches CameraX:

1. F1: main-queue focus (one line in the module).
2. F4: extract the pure policy functions, with tests.
3. F3: introduce `BoundSession` (done).
4. F2/F5: extract `CameraSessionController`; the view shrinks to rendering and input.

## Verification

- Read every main-source Kotlin file in full.
- Read `expo-modules-core` `AsyncFunctionComponent` and `BaseAsyncFunctionComponent` for the default queue.
- Not compiled. No JVM tests run. Not driven on a device. F1's runtime effect is inferred from the threading, not observed.
