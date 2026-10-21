---
title: Android live detector
aliases:
  - Live cat detector
tags:
  - implementation
  - camera
  - machine-vision
---

# Android live detector (yolo26n benchmark)

**Scope:** feature
**Issues/spec:** none filed. Request: deploy a bounding-box detector in the Android camera viewport. Benchmark model: yolo26n.
**Date:** 2026-10-21
**Branch/PR:** `feat-android-live-detector`

## Scope

**In scope:**

- [x] Run a LiteRT detector on CameraX `ImageAnalysis` frames in the native Android camera view.
- [x] Draw the detector's boxes over the preview, natively.
- [x] Send throttled detections to JS (`onDetections`).
- [x] Report benchmark numbers through the existing camera diagnostics.
- [x] A dev-only, Android-only setting: `camera_live_detector` ("Live Cat Detector").
- [x] A reproducible export script for yolo26n and for the later custom model.

**Out of scope / not addressed:**

- iOS. The prop is in the shared contract but marked Android only. The iOS view does not register it, so Expo ignores it there.
- Steering focus or exposure from a detection. `onDetections` boxes use the same space as `setSubjectRegion`, so this is a later step. It needs a product decision about tap-focus versus auto-focus.
- Cropping or tagging captures with the detection.
- The custom single-class model. The decoder and the export script already support it.

## Intent

**Purpose:** Get a live, on-device detector running in the native camera, measure it on real phones, and keep the path open for the custom binary cat model. yolo26n is the benchmark: it sets the speed and quality bar the custom model must meet.

## Design decisions and reasoning

### Runtime: LiteRT 2.3.0 CompiledModel, GPU then CPU

- **Decision:** `com.google.ai.edge.litert:litert:2.3.0` and `litert-gpu:2.3.0`. The model compiles for GPU first. If GPU fails to compile or to run the warm-up, it compiles for CPU (XNNPACK, 4 threads).
- **Reason:** Google's LiteRT docs call CompiledModel the current API. The 2.x `Interpreter` is CPU only. GPU with `Interpreter` needs the older 1.4.2 artifacts.
- **Constraint:** LiteRT 2.3.0 AARs declare minSdk 24. The app's minSdk is 24.

### Model export: `format="litert"`, `nms=False`, FP32

- **Decision:** `scripts/detector/export-detector.py` exports with ultralytics >= 8.4.83. The default is the end-to-end (NMS-free) head, FP32, 640 px.
- **Reason:** ultralytics 8.4.83 replaced the onnx2tf TFLite path with litert-torch. The new export has a planar `[1, 3, 640, 640]` input, not NHWC. The default `nms=None` now gives the raw head. `nms=False` gives YOLO26's end-to-end head, `[1, 300, 6]`, which needs no NMS on the phone. There is no FP16 file: LiteRT's GPU path runs FP32 models in FP16.
- **Both heads decode.** INT8 export forces the raw head. So `YoloDecoder` also decodes the raw `[1, 4 + C, A]` head (normalized xywh, sigmoid scores) and runs class-aware NMS.

### The model is not committed

- **Decision:** `assets/detector/` in the module is gitignored. Each build machine runs the export script. Without the files, the view reports `detector_unavailable` with `reason: model_missing`, and the camera works as before.
- **Reason:** yolo26n weights are AGPL-3.0. This repository is CC BY-NC 4.0. Committing or shipping AGPL weights in a CC BY-NC app is a license conflict. The custom model may not have this problem.
- **Effect:** a release build made on a machine without the export has no detector. That is the intended default for now.

### The detector is optional; the capture is not

- **Decision:** the view asks `CameraInfo.isSessionConfigSupported` for Preview + ImageCapture + ImageAnalysis. If it is not supported, or the bind throws, the view binds Preview + ImageCapture alone and reports `detector_unsupported_combination` or `detector_bind_failed`.
- **Reason:** a third stream can fail on some hardware, and zero-shutter-lag adds its own reprocessing stream. Losing the camera to a benchmark overlay is not acceptable.

### Coordinates: CameraX `CoordinateTransform`

- **Decision:** boxes go from the upright analysis frame to the `PreviewView` with `ImageProxyTransformFactory` (rotation on, crop rect off) and `PreviewView.outputTransform`. This needs `@OptIn(TransformExperimental::class)`.
- **Reason:** it handles rotation, `FILL_CENTER` scaling and front-camera mirroring. A hand-written mapping would repeat that work. The opt-in was checked against camera-view 1.6.2 bytecode.
- **Assumption:** the transform assumes the analysis and preview streams frame the same field. Both use 4:3. No `ViewPort` is set, because a `ViewPort` would also crop the saved photo to the screen's aspect ratio. `detector_ready` reports `preview_size`, `analysis_size` and `aspect_match` so a drive can check this.

### Native overlay, throttled JS event

- **Decision:** a plain Android `View` draws every frame's boxes. `onDetections` goes to JS at most every 200 ms, plus once when the boxes clear.
- **Reason:** per-frame boxes through the bridge cost more than they give. JS needs only the latest state.

### Threads

- **Decision:** one single-thread executor owns the analyzer, the `CompiledModel` and the stats. Box delivery and all events run on the main thread. A generation counter drops results from a session that was already unbound.
- **Reason:** keeps LiteRT on one thread, and stops stale boxes after a flip or rebind.
- The model stays loaded across rebinds while the setting is on. It is closed when the setting goes off, or in `OnViewDestroys`.

## What shipped

- `modules/native-identification-camera/android/…/LiveDetector.kt`: loads, compiles and warms up the model; letterbox preprocessing (gray 114, RGB 0..1, NCHW or NHWC); runs one frame.
- `…/YoloDecoder.kt`: decodes end-to-end and raw heads; letterbox inverse; clip; NMS.
- `…/DetectorSidecar.kt`: reads `assets/detector/detector.json`.
- `…/DetectorStats.kt`: 30-frame benchmark windows.
- `…/DetectionOverlayView.kt`: draws boxes and labels; never takes touch.
- `…/NativeIdentificationCameraView.kt`: `liveDetector` prop, ImageAnalysis use case, bind fallback, analyzer, delivery, `release()`.
- `…/NativeIdentificationCameraModule.kt`: `liveDetector` prop, `onDetections` event, `OnViewDestroys`.
- `…/android/build.gradle`: LiteRT dependencies.
- `modules/native-identification-camera/src/types.ts`, `index.ts`: `liveDetector`, `onDetections`, `NativeDetection`, `NativeDetectionsEvent`.
- `src/hooks/useSettingsStore.ts`: `camera_live_detector`, default off, `EXPO_PUBLIC_CAMERA_LIVE_DETECTOR` overrides the default for a drive.
- `src/screens/settings/index.tsx`: "Live Cat Detector" toggle (dev builds, Android only).
- `src/hooks/useNativeCameraCapture.tsx`, `src/screens/camera/NativeCameraScreen.tsx`: pass the prop; add `live_detector` to the camera performance payloads.
- `scripts/detector/export-detector.py`: export script.
- `.gitignore`: the detector asset folder.

### New diagnostics (only with `camera_performance_checks` on)

| `native_event`                     | Fields                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detector_ready`                   | `model_source`, `accelerator`, `load_ms`, `input_size`, `end_to_end`, `class_count`, `target_count`, `score_threshold`, `preview_size`, `analysis_size`, `aspect_match`, `gpu_failure`?       |
| `detector_stats`                   | `frames`, `fps`, `inference_ms_p50`, `inference_ms_p90`, `inference_ms_max`, `preprocess_ms_mean`, `decode_ms_mean`, `frames_with_detections`, `accelerator`, `output_layout`, `output_shape` |
| `detector_unavailable`             | `reason` (`model_missing`, `load_failed`, `inference_failed`), `message`?                                                                                                                     |
| `detector_unsupported_combination` | `camera_position`                                                                                                                                                                             |
| `detector_bind_failed`             | `message`, `camera_position`                                                                                                                                                                  |

`session_bound` also carries `live_detector` and `analysis_bound`.

## How to run it

1. Export the model once per machine:
   ```bash
   pip install "ultralytics[export-litert]>=8.4.83"
   python scripts/detector/export-detector.py
   ```
2. For the custom model later: `python scripts/detector/export-detector.py --weights path/to/best.pt --targets cat`.
3. Build with `npm run android`. To start a drive with the detector on, set `EXPO_PUBLIC_CAMERA_LIVE_DETECTOR=true` in `.env.android.local`, or turn on Settings → Live Cat Detector.
4. Turn on Camera Performance Checks to get the benchmark diagnostics.

## Tests

| Test file                                                         | What it verifies                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/__tests__/useNativeCameraCapture.liveDetector.test.ts` | The setting reaches the native view on Android and never on iOS. A mutation check confirmed it fails when the platform gate is removed. |

**Parity check (not committed):** `YoloDecoder` was compiled for the JVM and run on outputs of both exported heads for one cat photo (scikit-image `chelsea`). Both heads gave the same cat box as Ultralytics' own PyTorch prediction, within 0.02 of the frame on each edge (end-to-end: score 0.888; raw + NMS: 0.877; PyTorch: 0.896). The layout rules for 1-class and 2-class models were also checked.

**Not tested:** no native test suite exists in this repository (see `docs/agents/native-code.md`).

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`
- [x] Unit tests: `npx jest` (77 suites, 354 tests)
- [x] Lint: `npx expo lint src __tests__` (no new warnings)
- [x] Formatting: `npx prettier --check` on the changed TS files
- [ ] Native compile: see below

**Unverified — needs test drive:**

- No device or emulator run. The overlay alignment, GPU fallback, frame rate and thermal cost are unmeasured.
- Whether Preview + ImageCapture (ZSL) + ImageAnalysis binds on the target phones.
- `aspect_match` on real devices.

## Graveyard: pivots and corrections

### FP16 export no longer exists

- **Finding:** `half=True` fails in ultralytics 8.4.183: the LiteRT format accepts only FP32 and INT8 schemes.
- **Resolution:** FP32 export. The GPU accelerator runs it in FP16.

### Default export is no longer end-to-end

- **Finding:** in 8.4.83 and later, `nms=None` (the default) gives the raw head. Only `nms=False` gives YOLO26's end-to-end head.
- **Resolution:** the script passes `nms=False`. The decoder handles both.

### Independent review findings, fixed before merge

- **Finding:** with Camera Performance Checks off, the stats window never drained. Frame 31 overflowed the array, and the detector turned itself off without a report.
- **Resolution:** the window drains every 30 frames. Only the report depends on the setting.
- **Finding:** a session end cleared the native overlay but sent JS no empty `onDetections`, so JS kept a stale box.
- **Resolution:** `clearDetections()` sends one empty event when JS last saw boxes.
- **Finding:** the frame-rate probe for the three-stream config ran outside the fallback, so a throw there lost the camera.
- **Resolution:** a throw while building that config counts as unsupported, and the view binds without analysis.
- **Finding:** the output shape trusted the sidecar's `end2end` flag. A stale sidecar would decode a raw head as end-to-end rows.
- **Resolution:** the element count decides. The flag breaks only a true tie. The export script derives `end2end` from its own arguments and fails if the model metadata disagrees.

## Follow-ups and known limitations

- [ ] Device drive on a flagship and on a low-end phone; record `detector_stats` for both (the two-case rule for capture analysis).
- [ ] Decide whether a detection steers focus and exposure (`setSubjectRegion`).
- [ ] iOS implementation of `liveDetector`.
- [ ] License plan for any detector that ships to users.
- The camera vocabulary in `docs/agents/domain.md` is under review and says not to extend it, so "live detector" is not added there yet.
- `ImageProxy.toBitmap()` allocates per frame when a device pads RGBA rows. Unpadded frames reuse one bitmap.

## Implementation updates
