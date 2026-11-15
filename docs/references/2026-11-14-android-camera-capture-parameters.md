# Android camera capture parameters

Effect of CameraX and Camera2 still-capture controls on resolution, file size, latency, lighting and file type.

> This is the dated parameter catalog. For practical API ownership, capability
> checks, version-dependent CameraX interactions, and Camera2 recipes, start
> with [`Android native camera control guide`](2026-11-15-document-camera-behavior.md).

- Each claim has a source tag in square brackets. The [Sources](#sources) table lists the tags.
- Tags marked "Web search" come from a web search. Context7 did not confirm them.
- Tags `D1`–`Dn` are observations on a test device, not documentation.
- "Device-dependent" means: query the capability before you use the value.

## Legend

| Label          | Meaning                                                             |
| -------------- | ------------------------------------------------------------------- |
| **EXCLUSIVE**  | Pick one value. The values cannot be active together.               |
| **CONFLICT**   | Two separate controls. One control disables or overrides the other. |
| **COMBINABLE** | Controls work together.                                             |

---

## 1. Capture mode — latency vs quality

`ImageCapture.Builder.setCaptureMode(int)`. **EXCLUSIVE** [S2].

| Value                           | Constant                                              | Latency vs quality                                              | Default JPEG quality |
| ------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- | -------------------- |
| `CAPTURE_MODE_MAXIMIZE_QUALITY` | 0 [S1]                                                | Quality over latency. "Images may take longer to capture" [S1]. | 100 [S2]             |
| `CAPTURE_MODE_MINIMIZE_LATENCY` | 1, default [S1][S2]                                   | Latency over quality. "Image quality may be reduced" [S1].      | 95 [S2]              |
| `CAPTURE_MODE_ZERO_SHUTTER_LAG` | 2, `@ExperimentalZeroShutterLag`, CameraX 1.2.0+ [S1] | "Better latency while keeping good image quality" [S1]          | Not stated           |

Zero shutter lag (ZSL) rules:

- ZSL caches intermediate results. It delivers the one closest to the `takePicture` timestamp [S1].
- Query `CameraInfo.isZslSupported()` first [S1].

| Condition that disables ZSL automatically | Type     | Source |
| ----------------------------------------- | -------- | ------ |
| `VideoCapture` is bound                   | CONFLICT | [S1]   |
| Flash mode is not `FLASH_MODE_OFF`        | CONFLICT | [S1]   |
| An OEM extension is on                    | CONFLICT | [S1]   |

---

## 2. Resolution

### 2a. Allowed resolution mode

`ResolutionSelector.Builder.setAllowedResolutionMode(int)`. **EXCLUSIVE.** CameraX 1.3.0+ [S3].

| Value                                                     | Size pool                                             | Capture time                           | Source   |
| --------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | -------- |
| `PREFER_CAPTURE_RATE_OVER_HIGHER_RESOLUTION` (0, default) | "Normal output sizes"                                 | Normal                                 | [S3][S4] |
| `PREFER_HIGHER_RESOLUTION_OVER_CAPTURE_RATE` (1)          | `getOutputSizes()` + `getHighResolutionOutputSizes()` | "Might result in slower capture times" | [S3]     |

- Neither mode selects sizes from `SCALER_STREAM_CONFIGURATION_MAP_MAXIMUM_RESOLUTION` [S3].
- Those ultra-high sizes belong to the maximum-resolution sensor pixel mode. Some devices support it from Android 12 [S3].

### 2b. Resolution strategy

`ResolutionStrategy(boundSize, fallbackRule)`. The fallback rule is **EXCLUSIVE** [S5].

| Fallback rule                             | Behavior when `boundSize` is not available                     | Source   |
| ----------------------------------------- | -------------------------------------------------------------- | -------- |
| `FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER` | Closest higher size, then lower sizes. "Prioritize sharpness". | [S5][S7] |
| `FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER` | Closest lower size, then higher sizes. "Cap memory usage".     | [S5][S7] |

- The docs recommend one of these two rules [S5].
- Without a fallback, `bindToLifecycle` can throw `IllegalArgumentException` [S5].
- The default `ImageCapture` strategy is `HIGHEST_AVAILABLE_STRATEGY`. It selects the largest available size [S27].
- CameraX uses the selector as a hint. The output can differ because of device constraints [S27].

### 2c. Aspect ratio strategy

`AspectRatioStrategy(preferredAspectRatio, fallbackRule)` [S6].

| Field                  | Values                                       | Type      | Source |
| ---------------------- | -------------------------------------------- | --------- | ------ |
| `preferredAspectRatio` | `RATIO_4_3` or `RATIO_16_9`                  | EXCLUSIVE | [S6]   |
| `fallbackRule`         | `FALLBACK_RULE_AUTO` or `FALLBACK_RULE_NONE` | EXCLUSIVE | [S6]   |

- Default: `RATIO_4_3_FALLBACK_AUTO_STRATEGY` [S4].
- Set an aspect ratio that matches the resolution bound. Example: 1920x1080 with `RATIO_16_9_FALLBACK_AUTO_STRATEGY` [S4].
- CameraX supports only 4:3 and 16:9. Use a `ResolutionFilter` for other ratios [S4].
- OEMs can align sizes to mod 16. Example: 1920x1088 instead of 1920x1080 [S6].
- The docs recommend `FALLBACK_RULE_AUTO`. Otherwise binding can throw `IllegalArgumentException` [S6].

### 2d. Digital zoom

Camera2 `CONTROL_ZOOM_RATIO` (API 30+) or `SCALER_CROP_REGION` [S8][S9].

- The crop region is "the desired region of the sensor to read out" [S8].
- Output streams scale the sensor input "to match the output's configured resolution" [S8].
- With `zoomRatio`, leave the crop region at the default active array size [S8]. **CONFLICT** if you zoom with both.
- `zoomRatio` supports zoom-out below 1.0x. `SCALER_CROP_REGION` does not [S8].
- `zoomRatio` can combine optical and digital zoom on multi-camera systems [S8].
- RAW streams are not croppable unless the device supports the `CROPPED_RAW` stream use case [S8].
- From API 30, query the zoom range with `CONTROL_ZOOM_RATIO_RANGE` [S9].

---

## 3. Output file type

`ImageCapture.Builder.setOutputFormat(int)`, CameraX 1.4.0+. **EXCLUSIVE.** Default: `OUTPUT_FORMAT_JPEG` [S2].

| Value                          | Constant          | File(s)                         | Source                         |
| ------------------------------ | ----------------- | ------------------------------- | ------------------------------ |
| `OUTPUT_FORMAT_JPEG`           | 0                 | 8-bit SDR, `ImageFormat.JPEG`   | [S1]                           |
| `OUTPUT_FORMAT_JPEG_ULTRA_HDR` | 1                 | Ultra HDR, `ImageFormat.JPEG_R` | [S1]                           |
| `OUTPUT_FORMAT_RAW`            | 2, CameraX 1.5.0+ | `ImageFormat.RAW_SENSOR`        | [S1]; version: [S1] Web search |
| `OUTPUT_FORMAT_RAW_JPEG`       | 3, CameraX 1.5.0+ | `RAW_SENSOR` **and** `JPEG`     | [S1]                           |

Rules:

- Query `ImageCaptureCapabilities.getSupportedOutputFormats()` first [S2].
- An unsupported format makes binding throw `IllegalArgumentException` [S2].
- Supported formats can change when an extension is on [S2].
- Ultra HDR is available on capable devices from API 34 [S15].
- With `OUTPUT_FORMAT_RAW_JPEG`, `OnImageSavedCallback` fires twice: once per file [S21].
- Give separate output options for the DNG and the JPEG [S21].
- RAW output is not supported for HDR capture [S26].

---

## 4. File size — JPEG quality

`ImageCapture.Builder.setJpegQuality(int)`. CameraX 1.1.0+ [S2].

| Item                            | Value                                                                   | Source |
| ------------------------------- | ----------------------------------------------------------------------- | ------ |
| Range                           | 1–100. Larger is higher quality.                                        | [S2]   |
| Out of range                    | Throws `IllegalArgumentException`                                       | [S2]   |
| Default with `MINIMIZE_LATENCY` | 95                                                                      | [S2]   |
| Default with `MAXIMIZE_QUALITY` | 100                                                                     | [S2]   |
| Applies to                      | `ImageProxy` from `takePicture`, and the saved JPEG                     | [S2]   |
| Crop                            | A `ViewPort` or `setCropAspectRatio` crop is compressed at this quality | [S2]   |

- Capture mode sets the default quality. `setJpegQuality` replaces the default [S2]. **COMBINABLE.**

---

## 5. Lighting

### 5a. Flash mode

`ImageCapture.setFlashMode(int)` or `ImageCapture.Builder.setFlashMode(int)`. **EXCLUSIVE.** Default: `FLASH_MODE_OFF` [S1][S2].

| Value               | Rule                                                                                              | Source |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| `FLASH_MODE_OFF`    | Default                                                                                           | [S2]   |
| `FLASH_MODE_ON`     | —                                                                                                 | [S1]   |
| `FLASH_MODE_AUTO`   | Some LEGACY devices crash. CameraX disables auto flash on them.                                   | [S1]   |
| `FLASH_MODE_SCREEN` | Needs a `ScreenFlash` instance and the front camera. Otherwise throws `IllegalArgumentException`. | [S1]   |

- With no flash unit, every mode except `FLASH_MODE_SCREEN` acts as `FLASH_MODE_OFF` [S1].
- Check for a flash unit with `CameraInfo.hasFlashUnit()` [S1].
- Any flash mode except `OFF` disables ZSL [S1].

### 5b. Torch, low-light boost, flash — interactions

| Pair                                  | Type       | Rule                                                             | Source |
| ------------------------------------- | ---------- | ---------------------------------------------------------------- | ------ |
| Torch ↔ flash mode                    | CONFLICT   | Torch on: torch stays on during capture, whatever the flash mode | [S1]   |
| Torch ↔ low-light boost               | EXCLUSIVE  | "Last setting wins"                                              | [S11]  |
| Low-light boost ↔ flash               | COMBINABLE | Flash can fire for the capture. Boost stays on for preview.      | [S11]  |
| Low-light boost ↔ frame rate > 30 FPS | CONFLICT   | Boost is disabled. State stays `OFF`.                            | [S11]  |

### 5c. Low-light boost

`CameraControl.enableLowLightBoostAsync(boolean)`. CameraX 1.5.0+ [S11].

- Devices on Android 15 or higher can support it [S11].
- Query `CameraInfo.isLowLightBoostSupported()` first [S11].
- It adjusts brightness of preview, video and image analysis streams [S11].
- It turns on in low light and off in brighter light [S11].
- The future fails with `IllegalStateException` when not supported or when settings conflict [S11].
- Camera2 equivalent: AE mode `CONTROL_AE_MODE_ON_LOW_LIGHT_BOOST_BRIGHTNESS_PRIORITY` [S13].
- It is its own AE mode, because other AE settings are not compatible with its preview brightening [S13]. **EXCLUSIVE** with other AE modes.

### 5d. Night extension

`ExtensionMode.NIGHT` through `ExtensionsManager` [S14].

- Night mode combines a burst of photos into one image [S11].
- Night mode cannot create a continuous stream of frames. Low-light boost can [S11].
- Query `isExtensionAvailable(cameraSelector, ExtensionMode.NIGHT)` first [S14].
- Call `unbindAll()` before you enable a different extension mode [S14]. **EXCLUSIVE.**
- An extension disables ZSL [S1].
- Extensions do not support 10-bit preview or video. Dynamic range must be SDR [S15].
- Ultra HDR can work with an extension. Check formats with the extension-enabled `CameraInfo` [S15][S21].

### 5e. Exposure compensation

`CameraControl.setExposureCompensationIndex(int)` [S16].

- CameraX keeps only the latest outstanding request. A new call cancels the earlier one [S16].
- Read the applied value from `cameraInfo.exposureState.exposureCompensationIndex` [S16].

---

## 6. Camera2 processing modes — quality vs frame rate

Set through Camera2 interop on the use-case builder: `builder.camera2Interop { setCaptureRequestOption(key, value) }` [S17].

- `Camera2Interop.Extender.setCaptureRequestOption` is deprecated in CameraX 1.7.0-rc02 [S17].
- Interop values override CameraX internal values. They can interfere with `CameraControl` APIs and 3A behavior [S17].
- On `ImageCapture.Builder`, still-capture options override the same keys in repeating requests [S17].

### 6a. `CaptureRequest.NOISE_REDUCTION_MODE`

**EXCLUSIVE.** Query `NOISE_REDUCTION_AVAILABLE_NOISE_REDUCTION_MODES` [S8].

| Value              | Effect                                                                                     | Source |
| ------------------ | ------------------------------------------------------------------------------------------ | ------ |
| `OFF`              | No noise reduction, for both raw and YUV domain                                            | [S8]   |
| `MINIMAL`          | Only basic sensor raw-domain reduction. Optional on devices.                               | [S8]   |
| `FAST`             | No capture-rate loss. Can equal `MINIMAL` or `OFF`.                                        | [S8]   |
| `HIGH_QUALITY`     | Highest-quality filtering, even if capture rate drops                                      | [S8]   |
| `ZERO_SHUTTER_LAG` | Reduction on streams at or below max recording size. Larger streams get `MINIMAL` or none. | [S10]  |

### 6b. `CaptureRequest.EDGE_MODE` (sharpening)

**EXCLUSIVE.** Query `EDGE_AVAILABLE_EDGE_MODES` [S8].

| Value              | Effect                                                          | Source   |
| ------------------ | --------------------------------------------------------------- | -------- |
| `OFF`              | No enhancement                                                  | [S8]     |
| `FAST`             | No capture-rate loss. Can equal `OFF`. All devices list `FAST`. | [S8][S9] |
| `HIGH_QUALITY`     | Highest-quality enhancement, even if capture rate drops         | [S8]     |
| `ZERO_SHUTTER_LAG` | Enhancement on low-resolution streams only                      | [S8]     |

- Both keys are optional. The value can be `null` on some devices [S8].
- Both keys are present on all `HARDWARE_LEVEL_FULL` devices [S8].

---

## 7. Summary of exclusive groups

Each row repeats a rule from sections 1–6. The source is the section's source.

| Group                    | Choose one of                                                                               | Section |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------- |
| Capture mode             | `MAXIMIZE_QUALITY` / `MINIMIZE_LATENCY` / `ZERO_SHUTTER_LAG`                                | 1       |
| Allowed resolution mode  | `PREFER_CAPTURE_RATE_OVER_HIGHER_RESOLUTION` / `PREFER_HIGHER_RESOLUTION_OVER_CAPTURE_RATE` | 2a      |
| Resolution fallback      | `CLOSEST_HIGHER_THEN_LOWER` / `CLOSEST_LOWER_THEN_HIGHER`                                   | 2b      |
| Aspect ratio             | `RATIO_4_3` / `RATIO_16_9`                                                                  | 2c      |
| Output format            | `JPEG` / `JPEG_ULTRA_HDR` / `RAW` / `RAW_JPEG`                                              | 3       |
| Flash mode               | `OFF` / `ON` / `AUTO` / `SCREEN`                                                            | 5a      |
| Torch vs low-light boost | Torch / boost                                                                               | 5b      |
| Extension mode           | `NIGHT` / `BOKEH` / other `ExtensionMode` values / none                                     | 5d      |
| Noise reduction          | `OFF` / `MINIMAL` / `FAST` / `HIGH_QUALITY` / `ZERO_SHUTTER_LAG`                            | 6a      |
| Edge mode                | `OFF` / `FAST` / `HIGH_QUALITY` / `ZERO_SHUTTER_LAG`                                        | 6b      |
| Hot pixel mode           | `OFF` / `FAST` / `HIGH_QUALITY`                                                             | 8b      |

---

## 8. RAW (DNG) output

### 8a. Format and size

| Fact                                                                                                      | Source                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `RAW_SENSOR` usually holds a single-channel Bayer mosaic. Each sample has 16 bits.                        | [S23]                         |
| Devices with `REQUEST_AVAILABLE_CAPABILITIES_RAW` support `RAW_SENSOR` output.                            | [S10]                         |
| Those devices provide all DNG-related optional metadata.                                                  | [S10]                         |
| Maximum RAW size equals `SENSOR_INFO_PIXEL_ARRAY_SIZE` or `SENSOR_INFO_PRE_CORRECTION_ACTIVE_ARRAY_SIZE`. | [S10]                         |
| `DngCreator` writes `RAW_SENSOR` data to a DNG file.                                                      | [S24]                         |
| CameraX manages `DngCreator` internally to wrap RAW data.                                                 | [S22] Web search              |
| Whether a `ResolutionSelector` filters RAW sizes                                                          | Not settled. No source found. |

### 8b. Controls and RAW

| Control                                        | Effect on RAW                                                                         | Source            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------- |
| Capture mode                                   | Docs state latency and JPEG-quality defaults only. No RAW effect stated.              | [S1][S2] (silent) |
| `NOISE_REDUCTION_MODE` `OFF`                   | No reduction in raw or YUV domain                                                     | [S8]              |
| `NOISE_REDUCTION_MODE` `MINIMAL`               | Basic sensor raw-domain reduction only                                                | [S8]              |
| `NOISE_REDUCTION_MODE` `FAST` / `HIGH_QUALITY` | "Camera device determined". RAW effect not stated.                                    | [S8] (silent)     |
| `EDGE_MODE`                                    | Docs name YUV-domain enhancement only                                                 | [S8] (silent)     |
| `CONTROL_POST_RAW_SENSITIVITY_BOOST`           | No effect on `RAW_SENSOR`. Applies to YUV and JPEG.                                   | [S8]              |
| `HOT_PIXEL_MODE`                               | `OFF` / `FAST` / `HIGH_QUALITY`. Removes stuck or oversensitive pixels. Optional key. | [S8]              |
| `SENSOR_INFO_LENS_SHADING_APPLIED` (read-only) | True: RAW has some shading correction already. RAW-capable devices always report it.  | [S9]              |
| `BLACK_LEVEL_LOCK`                             | Locks black-level compensation. Present on FULL devices.                              | [S8]              |

### 8c. RAW conflicts

| Pair                            | Type             | Rule                                                             | Source           |
| ------------------------------- | ---------------- | ---------------------------------------------------------------- | ---------------- |
| RAW ↔ digital zoom              | CONFLICT         | RAW is not croppable unless the device supports `CROPPED_RAW`    | [S8]             |
| `CROPPED_RAW` constant          | —                | Value 6. Added in API 34.                                        | [S10] Web search |
| RAW ↔ stream use cases          | CONFLICT         | For RAW stream combinations, leave stream use cases as `DEFAULT` | [S9]             |
| RAW ↔ app-side ZSL reprocessing | EXCLUSIVE        | "Mutually exclusive ZSL … and DNG capture"                       | [S25]            |
| RAW ↔ HDR capture               | CONFLICT         | RAW output is not supported for HDR capture                      | [S26]            |
| RAW ↔ extensions                | Device-dependent | Supported formats can change with an extension on                | [S2]             |

Device tests that settle the open rows:

1. Bind RAW. Read `ImageCapture.getResolutionInfo()` with and without a `ResolutionSelector`.
2. Capture DNGs at noise reduction `OFF`, `FAST` and `HIGH_QUALITY`. Diff the pixel data.

---

## 9. CameraX and Camera2

**Layering: COMBINABLE.**

| Path                                      | Use                                                                        | Source |
| ----------------------------------------- | -------------------------------------------------------------------------- | ------ |
| `Camera2CameraInfo`                       | Read the underlying `CameraCharacteristics`                                | [S20]  |
| `Camera2CameraControl`                    | Set `CaptureRequest` keys. They affect all use cases on that camera.       | [S19]  |
| `Camera2Interop.Extender`                 | Set `CaptureRequest` keys and the stream use case on one use case          | [S20]  |
| `ImageCapture.Builder.camera2Interop { }` | Still-capture keys, request template, capture callback, physical camera ID | [S18]  |

- Interop options override CameraX internal configuration. "May result in unexpected behavior" [S18][S19].

**Runtime ownership: EXCLUSIVE per camera ID.**

| Rule                                                                                                                | Source |
| ------------------------------------------------------------------------------------------------------------------- | ------ |
| A second open of the same camera ID in one app disconnects the first `CameraDevice`. Its ongoing tasks are dropped. | [S28]  |
| A higher-priority client can take the camera. The other client gets `onDisconnected`.                               | [S28]  |
| Open can fail with `ERROR_CAMERA_IN_USE`.                                                                           | [S29]  |

---

## 10. Device observations — Pixel 7

Command: `adb shell dumpsys media.camera`, filtered by key name. Run on 2026-11-14 [D1].

| Observation                                                                                  | Source                         |
| -------------------------------------------------------------------------------------------- | ------------------------------ |
| Every `android.request.availableCapabilities` entry lists `RAW`.                             | [D1]                           |
| Every `android.info.supportedHardwareLevel` entry is `FULL`.                                 | [D1]                           |
| Every `android.scaler.availableStreamUseCases` entry lists `0 1 2 3 4 5`.                    | [D1]                           |
| No entry lists `6` (`CROPPED_RAW`). Digital zoom therefore does not crop RAW on this device. | [D1] + [S8] + [S10] Web search |
| One entry lists `android.scaler.availableMaxDigitalZoom` = 8.0.                              | [D1]                           |

- `RAW` in the Camera2 capabilities does not prove that CameraX lists `OUTPUT_FORMAT_RAW`. Check `getSupportedOutputFormats()` in the app. No source links the two.

## 11. Build observations — this app

| Observation                                                                                                    | Source                 |
| -------------------------------------------------------------------------------------------------------------- | ---------------------- |
| The camera module declares CameraX 1.6.2 (`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`). | [D2]                   |
| `react-native-vision-camera` declares CameraX 1.7.0-alpha01, including `camera-extensions`.                    | [D3]                   |
| The app release build resolves all CameraX artifacts to 1.7.0-alpha01.                                         | [D4]                   |
| 1.7.0-alpha01 is later than 1.5.0, so `OUTPUT_FORMAT_RAW` exists in the resolved version.                      | [D4] + [S1] Web search |
| The module's Kotlin source never calls `setOutputFormat`. Its only capture call is `takePicture`.              | [D5]                   |
| With no output format set, `ImageCapture` uses `OUTPUT_FORMAT_JPEG`.                                           | [S2]                   |
| Not yet checked: whether `getSupportedOutputFormats()` lists RAW on the Pixel 7.                               | —                      |

---

## 12. Control surfaces besides `ImageCapture`

### 12a. CameraX use cases

| Surface         | Output                                                                          | Source |
| --------------- | ------------------------------------------------------------------------------- | ------ |
| `ImageCapture`  | Still files: JPEG, Ultra HDR, RAW, RAW+JPEG (section 3)                         | [S1]   |
| `ImageAnalysis` | Per-frame `ImageProxy`: `YUV_420_888` (default), `RGBA_8888`, `NV21`, `PRIVATE` | [S30]  |
| `Preview`       | Viewfinder frames                                                               | [S20]  |
| `VideoCapture`  | Video recording                                                                 | [S20]  |

`ImageAnalysis` rules:

- `RGBA_8888` and `NV21` add overhead, because format conversion takes time [S30].
- `PRIVATE` is not CPU accessible. Use it for GPU processing [S30].
- `PRIVATE` does not allow `setOutputImageRotationEnabled(true)` [S30].
- Check support with `ImageAnalysisCapabilities.isOutputFormatSupported(int)` [S30].
- `ImageAnalysis` takes a `ResolutionSelector` [S7].
- `STRATEGY_KEEP_ONLY_LATEST` drops older frames while the analyzer is busy [S7].

Use-case combinations:

| Combination                                                                     | Status                                                                             | Source |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| One each of `Preview`, `VideoCapture`, `ImageAnalysis`, `ImageCapture`          | Allowed together                                                                   | [S20]  |
| Higher resolutions                                                              | Some cameras support a combination only at lower resolution                        | [S20]  |
| Extensions on                                                                   | Only `ImageCapture` + `Preview` is guaranteed. `ImageAnalysis` depends on the OEM. | [S20]  |
| Extensions + `VideoCapture`                                                     | Not possible                                                                       | [S20]  |
| FULL or lower: `Preview` + `VideoCapture` + (`ImageCapture` or `ImageAnalysis`) | Can force stream sharing: higher latency, less battery                             | [S20]  |
| `Preview` + `VideoCapture` + `ImageCapture`                                     | `LIMITED` and above                                                                | [S31]  |
| `Preview` + `VideoCapture` + `ImageAnalysis`                                    | `LEVEL_3`                                                                          | [S31]  |
| All four                                                                        | Not supported                                                                      | [S31]  |

Note: [S20] and [S31] disagree about all four use cases together.

### 12b. Camera-wide controls (all bound use cases)

| Surface                       | Controls                                                                                                           | Source     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| `CameraControl`               | `setZoomRatio`, `startFocusAndMetering`, `setExposureCompensationIndex`, `enableTorch`, `enableLowLightBoostAsync` | [S11]      |
| `Camera2CameraControl`        | Any `CaptureRequest` key, for all use cases on the camera                                                          | [S19]      |
| Per-use-case `camera2Interop` | `CaptureRequest` keys for one use case                                                                             | [S17][S18] |

- Only one `FocusMeteringAction` runs at a time. The latest one cancels the others [S11].
- `setZoomRatio` outside `ZoomState` min/max fails with `IllegalArgumentException` [S11].

### 12c. Camera2 directly

- A Camera2 capture session can target `RAW`, `YUV`, `JPEG` and `PRIV` streams together, in the documented combinations [S25].
- Example: `PRIV` preview + `YUV` preview + `RAW` maximum is "Preview with in-app processing and DNG capture" [S25].
- Camera2 and CameraX cannot own the same camera ID at the same time (section 9) [S28].

## 13. CameraX alpha in this build

| Observation                                                                                                                                                                                                 | Source     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1.7.0-alpha01 was released on March 11, 2026.                                                                                                                                                               | [S22]      |
| 1.7.0-alpha01 API change: `CameraController.setSessionConfig()` is exposed.                                                                                                                                 | [S22]      |
| 1.7.0-alpha01 bug fix: libraries target Java 11. This "might require desugaring".                                                                                                                           | [S22]      |
| 1.7.0-alpha01 bug fix: `ImageAnalysis` rotation when output rotation is on and the initial rotation is 0.                                                                                                   | [S22]      |
| Latest stable is 1.6.2, released August 26, 2026. Latest RC is 1.7.0-rc02.                                                                                                                                  | [S22][S32] |
| Alpha: "APIs may be added, removed, or changed".                                                                                                                                                            | [S32]      |
| Beta: "ready for production use but may contain bugs".                                                                                                                                                      | [S32]      |
| RC: "Its API surface is final".                                                                                                                                                                             | [S32]      |
| Vision Camera v5.1.0 pins 1.7.0-alpha01. The pin is present from the first V5 commit.                                                                                                                       | [D3][D6]   |
| The V5 PR description has 92 characters. It states no reason for the CameraX version.                                                                                                                       | [D6]       |
| Vision Camera `main` now pins 1.7.0-alpha03.                                                                                                                                                                | [D6]       |
| `CameraController.setSessionConfig(sessionConfig, cameraSelector)`: the `SessionConfig` must contain a `Preview`. It can be an `ExtensionSessionConfig`.                                                    | [S27]      |
| After it is set, most `CameraController` setters throw `IllegalStateException`. The use-case configuration is immutable.                                                                                    | [S27]      |
| Setters still allowed: `setImageCaptureFlashMode`, `setCameraSelector`, `setPinchToZoomEnabled`, `setTapToFocusEnabled`, `setTapToFocusAutoCancelDuration`, `setZoomRatio`, `setLinearZoom`, `enableTorch`. | [S27]      |
| `setEnabledUseCases` throws `IllegalStateException` once a `SessionConfig` is set.                                                                                                                          | [S27]      |
| `CameraController` overwrites the `SurfaceProvider`, the `ViewPort` and the auto-rotation setting in the given `SessionConfig`.                                                                             | [S27]      |
| `HighSpeedVideoSessionConfig` is not supported.                                                                                                                                                             | [S27]      |
| A `VideoCapture` in the `SessionConfig` needs a `Recorder`.                                                                                                                                                 | [S27]      |
| Docs recommend `CameraInfo.isSessionConfigSupported(SessionConfig)` before you set an advanced `SessionConfig`.                                                                                             | [S27]      |
| The camera module uses `androidx.camera.core.SessionConfig` with `ProcessCameraProvider`. It does not use `CameraController`.                                                                               | [D7]       |
| The module compiles against 1.6.2, so its `SessionConfig` use does not need the alpha.                                                                                                                      | [D2][D7]   |

## 14. `CameraController` vs `ProcessCameraProvider`

The docs name these as the "2 ways to write a CameraX app" [S20]. The docs do not say whether one app can mix them.

| Aspect                 | `CameraController` (`LifecycleCameraController`)                                  | `CameraProvider` (`ProcessCameraProvider`)                          | Source     |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| Docs recommendation    | "The simplest way to use CameraX"                                                 | "Great if you need more flexibility"                                | [S20]      |
| Setup code             | Little                                                                            | App configures and binds each use case                              | [S20][S33] |
| Handled for you        | Initialization, use-case management, target rotation, tap-to-focus, pinch-to-zoom | Nothing automatic; app builds use cases and calls `bindToLifecycle` | [S20]      |
| Default use cases      | `Preview`, `ImageCapture`, `ImageAnalysis`. Toggle with `setEnabledUseCases()`.   | None implied. The app sets up `Preview` itself.                     | [S20][S33] |
| Preview surface        | Requires `PreviewView`                                                            | Can use a custom `Surface`                                          | [S33]      |
| Crop                   | `PreviewView` sets the crop rect for all use cases to match what the user sees    | App sets it                                                         | [S34]      |
| Customization examples | —                                                                                 | Output image rotation; `ImageAnalysis` output image format          | [S33]      |
| Integration example    | ML Kit maps model result coordinates onto preview coordinates                     | Reuse existing `Surface` code                                       | [S33]      |

## 15. Not covered

- Measured latency in milliseconds per mode. The docs give only relative terms [S1].
- File size in bytes per JPEG quality value.
- `CaptureRequest.JPEG_QUALITY` through interop, and its priority against `setJpegQuality`.
- CameraX `setZoomRatio` / `setLinearZoom` reference text.

---

## Sources

Context7 libraries: `/websites/developer_android`, `/websites/developer_android_reference_android_hardware_camera2`. Fetched 2026-11-14.

| Tag | Page                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | [ImageCapture](https://developer.android.com/reference/kotlin/androidx/camera/core/ImageCapture)                                                                                                                                                              |
| S2  | [ImageCapture.Builder](https://developer.android.com/reference/kotlin/androidx/camera/core/ImageCapture.Builder)                                                                                                                                              |
| S3  | [ResolutionSelector](https://developer.android.com/reference/kotlin/androidx/camera/core/resolutionselector/ResolutionSelector)                                                                                                                               |
| S4  | [ResolutionSelector.Builder](https://developer.android.com/reference/kotlin/androidx/camera/core/resolutionselector/ResolutionSelector.Builder)                                                                                                               |
| S5  | [ResolutionStrategy](https://developer.android.com/reference/kotlin/androidx/camera/core/resolutionselector/ResolutionStrategy)                                                                                                                               |
| S6  | [AspectRatioStrategy](https://developer.android.com/reference/kotlin/androidx/camera/core/resolutionselector/AspectRatioStrategy)                                                                                                                             |
| S7  | [SmileID CameraX blog](https://developer.android.com/blog/posts/smileid-camerax-android-identity-verification)                                                                                                                                                |
| S8  | [CaptureRequest](https://developer.android.com/reference/android/hardware/camera2/CaptureRequest)                                                                                                                                                             |
| S9  | [CameraCharacteristics](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics)                                                                                                                                               |
| S10 | [CameraMetadata](https://developer.android.com/reference/android/hardware/camera2/CameraMetadata)                                                                                                                                                             |
| S11 | [CameraControl](https://developer.android.com/reference/kotlin/androidx/camera/core/CameraControl)                                                                                                                                                            |
| S12 | [Low Light Boost blog](https://developer.android.com/blog/posts/brighten-your-real-time-camera-feeds-with-low-light-boost)                                                                                                                                    |
| S13 | [Low Light Boost AE guide](https://developer.android.com/media/camera/lowlight/low-light-boost-ae)                                                                                                                                                            |
| S14 | [CameraX Extensions API guide](https://developer.android.com/media/camera/camerax/extensions-api)                                                                                                                                                             |
| S15 | [ExtensionsManager](https://developer.android.com/reference/kotlin/androidx/camera/extensions/ExtensionsManager)                                                                                                                                              |
| S16 | [CameraX configuration guide](https://developer.android.com/media/camera/camerax/configuration)                                                                                                                                                               |
| S17 | [Camera2Interop.Extender](https://developer.android.com/reference/kotlin/androidx/camera/camera2/interop/Camera2Interop.Extender)                                                                                                                             |
| S18 | [camera2 interop package](https://developer.android.com/reference/kotlin/androidx/camera/camera2/interop/package-summary)                                                                                                                                     |
| S19 | [Camera2CameraControl](https://developer.android.com/reference/androidx/camera/camera2/interop/Camera2CameraControl)                                                                                                                                          |
| S20 | [CameraX architecture guide](https://developer.android.com/media/camera/camerax/architecture)                                                                                                                                                                 |
| S21 | [CameraX video and pro image capture blog](https://developer.android.com/blog/posts/introducing-camera-x-powerful-video-recording-and-pro-level-image-capture)                                                                                                |
| S22 | [CameraX release notes](https://developer.android.com/jetpack/androidx/releases/camera) — Web search; sections 13 rows read directly, 2026-11-14                                                                                                              |
| S23 | [ImageFormat](https://developer.android.com/reference/android/graphics/ImageFormat)                                                                                                                                                                           |
| S24 | [DngCreator](https://developer.android.com/reference/android/hardware/camera2/DngCreator)                                                                                                                                                                     |
| S25 | [CameraDevice](https://developer.android.com/reference/android/hardware/camera2/CameraDevice)                                                                                                                                                                 |
| S26 | [TotalCaptureResult](https://developer.android.com/reference/kotlin/android/hardware/camera2/TotalCaptureResult)                                                                                                                                              |
| S27 | [CameraController](https://developer.android.com/reference/kotlin/androidx/camera/view/CameraController)                                                                                                                                                      |
| S28 | [CameraManager](https://developer.android.com/reference/android/hardware/camera2/CameraManager)                                                                                                                                                               |
| S29 | [CameraDevice.StateCallback](https://developer.android.com/reference/android/hardware/camera2/CameraDevice.StateCallback)                                                                                                                                     |
| S30 | [ImageAnalysis.Builder](https://developer.android.com/reference/kotlin/androidx/camera/core/ImageAnalysis.Builder) and [ImageAnalysis](https://developer.android.com/reference/kotlin/androidx/camera/core/ImageAnalysis)                                     |
| S31 | [CameraX getting-started codelab](https://developer.android.com/codelabs/camerax-getting-started)                                                                                                                                                             |
| S32 | [AndroidX versions](https://developer.android.com/jetpack/androidx/versions), read 2026-11-14                                                                                                                                                                 |
| S33 | [Migrate Camera1 to CameraX](https://developer.android.com/media/camera/camerax/camera1-to-camerax)                                                                                                                                                           |
| S34 | [PreviewView](https://developer.android.com/reference/kotlin/androidx/camera/view/PreviewView)                                                                                                                                                                |
| D1  | Pixel 7 (`panther`), `adb shell dumpsys media.camera`, 2026-11-14                                                                                                                                                                                             |
| D2  | `modules/native-identification-camera/android/build.gradle:21-24`                                                                                                                                                                                             |
| D3  | `node_modules/react-native-vision-camera/android/build.gradle:155-162` (package version 5.1.0)                                                                                                                                                                |
| D4  | `android/app/build/outputs/sdk-dependencies/release/sdkDependencies.txt:2351-2624`, built 2026-11-14                                                                                                                                                          |
| D5  | Grep of `modules/native-identification-camera/android/src/main` for `OutputFormat`, `OUTPUT_FORMAT`, `getImageCaptureCapabilities`, `supportedOutputFormats`, `takePicture`. Only match: `NativeIdentificationCameraView.kt:665` (`takePicture`).             |
| D6  | GitHub `mrousavy/react-native-vision-camera`: PR #3735 ("feat: V5.", merged 2026-04-16) via `gh pr view`; commits 30a8b5de4, 3b46a05f4, b5dc50672 (subagent-found)                                                                                            |
| D7  | Grep of `modules/native-identification-camera/android/src/main` for `CameraController`, `setSessionConfig`, `SessionConfig`. Matches only in `NativeIdentificationCameraView.kt` (lines 32, 186, 489–557, 611–613), all `androidx.camera.core.SessionConfig`. |
