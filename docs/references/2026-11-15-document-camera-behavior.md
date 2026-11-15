# Android native camera control guide

**Reviewed:** 2026-11-15

This is a practical guide to controlling an Android device camera from native
Kotlin. It covers the two native API layers:

- **Camera2** (`android.hardware.camera2`) is the Android platform camera API.
  It exposes camera IDs, static characteristics, capture requests, capture
  results, sessions, and image streams directly.
- **CameraX** (`androidx.camera`) is a native Kotlin Jetpack library built on
  Camera2. It is not a platform API. It supplies lifecycle binding, use cases,
  capability-aware common controls, and device compatibility behavior while
  retaining Camera2 interop for selected controls.

Use this document to choose an ownership model and implement a control. It is
not a statement that any particular device supports every control. Query the
capability on the camera being opened, handle an unsupported request, and
record what was actually applied.

Official starting points: [CameraX architecture](https://developer.android.com/media/camera/camerax/architecture),
[CameraX configuration](https://developer.android.com/media/camera/camerax/configuration),
[Camera2 camera enumeration](https://developer.android.com/media/camera/camera2/camera-enumeration),
and [Camera2 capture sessions and requests](https://developer.android.com/media/camera/camera2/capture-sessions-requests).

## 1. Pick the owner before writing controls

### Use CameraX when

- the app needs a preview plus still capture;
- the camera should start and stop with an Android `LifecycleOwner`;
- common controls are enough: zoom, torch, focus/metering, exposure
  compensation, or low-light boost (supported devices only: CameraX 1.5.0+,
  Android 15+);
- CameraX use cases can own all output surfaces; and
- device compatibility and ordinary JPEG capture matter more than complete
  sensor-level control.

`ProcessCameraProvider` is the flexible CameraX entry point. A
`LifecycleCameraController` is simpler when its managed use cases and
`PreviewView` are sufficient. After `CameraController.setSessionConfig`
(reference: added 1.7.0-rc02), most controller setters throw
`IllegalStateException`; flash mode, camera selector, zoom, torch, and
tap/pinch settings remain. Do not make both owners open the same camera at
the same time.

### Use direct Camera2 when

- the app needs custom RAW/result pairing, a custom stream combination, or a
  custom `CameraCaptureSession` (CameraX also supports RAW/RAW+JPEG from 1.5.0);
- the app needs manual ISO, exposure time, focus, white balance, or
  post-processing keys and prefers direct control over CameraX's experimental
  Camera2 interop (section 12);
- capture-result metadata and request sequencing are part of the product
  contract; or
- CameraX cannot express the required session or output configuration.

Direct Camera2 means the app owns camera-thread serialization, session
creation, output readers, request sequencing, result matching, and cleanup.
That is a larger correctness surface, not merely a lower-level spelling of
CameraX.

### Do not mix ownership casually

Never let CameraX and direct Camera2 own the same camera ID at once. A second
`openCamera` for an ID the app already holds succeeds, but the first owner gets
`onDisconnected` and its in-flight work is dropped; a higher-priority client
can also take the camera. If a
CameraX interop path is selected, let CameraX create and manage the session.
If direct Camera2 is selected, close CameraX use cases before opening the
`CameraDevice`.

Official sources: [Camera2 `CameraManager`](https://developer.android.com/reference/android/hardware/camera2/CameraManager),
[choosing a camera API](https://developer.android.com/media/camera/choose-camera-library),
and [CameraX architecture](https://developer.android.com/media/camera/camerax/architecture).

## 2. Establish permissions, storage, and lifecycle

### Camera permission

Declare and request `android.permission.CAMERA` before opening either API.
Treat denial, “only this time”, revocation, and a permission request result as
normal states. Do not open a camera before the grant is confirmed.

```kotlin
private val requestCamera = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
) { granted ->
    if (granted) startCamera() else showCameraPermissionExplanation()
}

fun ensureCameraPermission() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    ) {
        startCamera()
    } else {
        requestCamera.launch(Manifest.permission.CAMERA)
    }
}
```

The snippet assumes a `ComponentActivity` and imports from
`android.Manifest`, `android.content.pm.PackageManager`,
`androidx.activity.result.contract.ActivityResultContracts`, and
`androidx.core.content.ContextCompat`. A native camera module should also stop
its session when the host view is detached or its lifecycle is stopped.

Official source: [requesting runtime permissions](https://developer.android.com/training/permissions/requesting).

### Choose an output location

Use a private cache/files path when the app owns the image and will upload or
process it. Use `MediaStore` when the user asked to keep the image in shared
photos. On Android 10/API 29 and later, write shared images through
`MediaStore` and `RELATIVE_PATH`; do not request broad storage permission for a
new app merely to write its own image. For older Android versions, use the
legacy external-storage permission only when the app's supported API range and
product requirement still need it.

```kotlin
val values = ContentValues().apply {
    put(MediaStore.Images.Media.DISPLAY_NAME, "cat-${System.currentTimeMillis()}.jpg")
    put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/FeralSpotter")
    }
}
val outputOptions = ImageCapture.OutputFileOptions.Builder(
    contentResolver,
    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
    values
).build()
imageCapture.takePicture(outputOptions, executor, callback)
```

For CameraX, pass the collection URI as above; its output builder creates the
row. Do not pre-insert a row and pass that item URI as the collection. For
direct Camera2, insert the row yourself, use `IS_PENDING=1` on API 29+, write
through its output stream, then publish with `IS_PENDING=0`; delete the row
on failure. The fragment assumes a configured `ImageCapture`, executor, and
`OnImageSavedCallback`. Keep private temporary files out of shared photos
unless retention is intended.

Official source: [scoped storage](https://developer.android.com/about/versions/10/privacy/changes#scoped-storage)
and [shared media](https://developer.android.com/training/data-storage/shared/media).

### Lifecycle ownership

Bind CameraX to the host `LifecycleOwner`; keep `Camera`, `CameraInfo`, and
use-case references only while bound. CameraX resets zoom, torch, focus,
metering, and exposure state when the camera closes. Re-apply desired runtime
state after a new bind.

For Camera2, create one serialized camera executor or handler, open from the
camera thread, close the session/device/readers in reverse ownership order, and
never keep a stale `CameraDevice`, `CameraCaptureSession`, or `ImageReader`
after close. All callbacks must tolerate teardown races.

## 3. Discover what the device can do

### CameraX capability checks

After `bindToLifecycle`, obtain `CameraInfo` and `CameraControl` from the
returned `Camera`. Check the relevant state before exposing a control:

| Desired control       | CameraX query or state                                 | What it means                                                              |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Torch or flash        | `cameraInfo.hasFlashUnit()`                            | The camera has a flash unit; screen flash is a separate front-camera path. |
| Zoom                  | `cameraInfo.zoomState`                                 | Read min, max, current, and linear zoom; do not assume 1x–5x.              |
| Low-light boost       | `cameraInfo.isLowLightBoostSupported()`                | CameraX 1.5.0+; enable with `enableLowLightBoostAsync`.                    |
| Exposure compensation | `cameraInfo.exposureState`                             | Read supported index range and applied index.                              |
| Focus/metering        | `cameraInfo.isFocusMeteringSupported(action)`          | True if ≥1 requested AF/AE/AWB region is supported; false ⇒ start fails.   |
| ZSL                   | `cameraInfo.isZslSupported()`                          | Capability, not a promise; needs `@ExperimentalZeroShutterLag` opt-in.     |
| Output format         | `ImageCapture.getImageCaptureCapabilities(cameraInfo)` | 1.4.0+; always includes JPEG; re-query with extension-enabled `CameraInfo`. |
| Extension             | `ExtensionsManager.isExtensionAvailable(...)`          | The selected lens and mode support that extension.                         |

For every request, handle a failed `ListenableFuture` or binding exception.
`IllegalArgumentException` commonly means that a requested format, size,
strategy, or combination is not supported by the current device/configuration.

### Camera2 capability inventory

Enumerate camera IDs, then read characteristics before opening the device:

```kotlin
val manager = getSystemService(CameraManager::class.java)
for (cameraId in manager.cameraIdList) {
    val c = manager.getCameraCharacteristics(cameraId)
    val facing = c.get(CameraCharacteristics.LENS_FACING)
    val caps = c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
        ?.toSet().orEmpty()
    val map = c.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
    val raw = CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW in caps
    val manualSensor =
        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR in caps
    val manualPost =
        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_POST_PROCESSING in caps
    val zoomRange = if (Build.VERSION.SDK_INT >= 30) {
        c.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
    } else null
    // Select only after checking the exact streams and controls required.
}
```

The snippet uses `getSystemService(Class)` (API 23+; use
`Context.CAMERA_SERVICE` below that) and assumes `CAMERA` permission and a
non-null stream configuration map. The capability enum is not a numeric quality ranking. Check the actual
keys and values, output sizes, hardware level, and stream combinations needed
by the chosen camera. `REQUEST_AVAILABLE_CAPABILITIES_RAW` is required for a
RAW sensor stream. Physical camera IDs require API 28 or later.

Official sources: [camera enumeration](https://developer.android.com/media/camera/camera2/camera-enumeration),
[`CameraCharacteristics`](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics),
and [`SCALER_STREAM_CONFIGURATION_MAP`](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#SCALER_STREAM_CONFIGURATION_MAP).

## 4. CameraX: bind preview and still capture

The normal CameraX path is `Preview` plus `ImageCapture` bound in one call.
`build()` returns an immutable use case; later builder changes do not affect
it. Build a new use case and rebind to change capture mode, resolution
selector, output format, or JPEG quality. Flash mode and target rotation have
runtime setters on `ImageCapture`.

```kotlin
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat

private fun bindCamera(previewView: PreviewView, owner: LifecycleOwner) {
    val future = ProcessCameraProvider.getInstance(previewView.context)
    future.addListener({
      try {
        val provider = future.get()
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }
        val resolution = ResolutionSelector.Builder()
            .setAllowedResolutionMode(
                ResolutionSelector.PREFER_HIGHER_RESOLUTION_OVER_CAPTURE_RATE
            )
            .setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)
            .build()
        val imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setResolutionSelector(resolution)
            .setJpegQuality(95)
            .build()
        provider.unbindAll()
        val camera = provider.bindToLifecycle(
            owner,
            CameraSelector.DEFAULT_BACK_CAMERA,
            preview,
            imageCapture
        )
        onCameraBound(camera, imageCapture)
      } catch (exception: Exception) {
        onCameraSetupFailed(exception)
      }
    }, ContextCompat.getMainExecutor(previewView.context))
}
```

The fragment assumes a `LifecycleOwner` (import `androidx.lifecycle.LifecycleOwner`),
a `PreviewView`, CameraX 1.3.0+ dependencies (section 3's table also needs
1.4.0 for output-format queries and screen flash, 1.5.0 for low-light boost),
and host callbacks that retain the
bound camera/use case or show setup failure. `unbindAll()` assumes this screen
owns all provider use cases; otherwise unbind only its own use cases. Run this
on the main thread after permission is granted.

The higher-resolution mode admits ordinary and high-resolution output sizes;
it does **not** select Android 12's maximum-resolution sensor pixel mode or
`SCALER_STREAM_CONFIGURATION_MAP_MAXIMUM_RESOLUTION`. For a bounded size, use
`ResolutionStrategy(boundSize, FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)` and
an aspect-ratio strategy matching that size. Inspect `imageCapture.resolutionInfo`
after binding; the whole stream combination constrains what is selected.

Official sources: [CameraX architecture](https://developer.android.com/media/camera/camerax/architecture)
and [`ResolutionSelector`](https://developer.android.com/reference/androidx/camera/core/resolutionselector/ResolutionSelector).

### Use-case combinations

Bind at most one each of `Preview`, `VideoCapture`, `ImageAnalysis`, and
`ImageCapture`. Higher resolutions or a lower hardware level can make a
combination unsupported, and an unsupported set fails at bind. On FULL or lower,
`Preview` + `VideoCapture` + another use case can force stream sharing (higher
latency, more battery). Official sources disagree on all four at once: the
architecture guide allows them; the getting-started codelab says not supported.
Test the target device.

`ImageAnalysis` defaults to `YUV_420_888`; `RGBA_8888` and `NV21` (1.5.0+) cost
conversion time; `PRIVATE` is GPU-only. Close every `ImageProxy`: an unclosed
one stalls analysis, and `STRATEGY_BLOCK_PRODUCER` can stall `Preview` too.
`STRATEGY_KEEP_ONLY_LATEST` drops frames while the analyzer is busy.

### Save a JPEG and surface failures

```kotlin
fun captureJpeg(imageCapture: ImageCapture, file: File, executor: Executor) {
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    imageCapture.takePicture(
        options,
        executor,
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(result: ImageCapture.OutputFileResults) {
                onCaptureApplied(file, file.length())
            }

            override fun onError(exception: ImageCaptureException) {
                onCaptureFailed(exception.imageCaptureError, exception)
            }
        }
    )
}
```

The callback must not update a dead view or claim success before the file is
closed and readable. For a URI, use the `ContentResolver` output builder and
verify the returned URI. Do not swallow `ERROR_FILE_IO`, `ERROR_CAPTURE_FAILED`,
`ERROR_CAMERA_CLOSED`, `ERROR_INVALID_CAMERA`, or `ERROR_UNKNOWN`.

Official source: [CameraX take a photo](https://developer.android.com/media/camera/camerax/take-photo).

## 5. CameraX controls: what changes at runtime

| Control               | Runtime operation                             | Effect on sensor/output                                                                | Capability and caveat                                                                     |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Zoom ratio            | `camera.cameraControl.setZoomRatio(value)`    | Changes the camera crop/zoom for bound use cases; saved capture is zoomed too.         | Clamp to `ZoomState.minZoomRatio..maxZoomRatio`; future can fail.                         |
| Linear zoom           | `setLinearZoom(0f..1f)`                       | Maps a UI slider to the device's zoom range.                                           | Read the resulting `ZoomState`; do not equate slider position with optical magnification. |
| Focus/metering        | `startFocusAndMetering(action)`               | Requests AF/AE/AWB from normalized `MeteringPoint`s; CameraX maps them to sensor regions. | Use supported metering points and cancel/replace the previous action.                     |
| Exposure compensation | `setExposureCompensationIndex(index)`         | Biases automatic exposure; does not mean a fixed shutter or ISO.                       | Read the applied index from `ExposureState`; latest outstanding request wins.             |
| Torch                 | `enableTorch(true/false)`                     | Keeps the torch on for preview and capture.                                            | Requires `hasFlashUnit`; future can fail.                                                 |
| Still flash           | `imageCapture.flashMode = OFF/ON/AUTO/SCREEN` | Adds flash behavior to still capture; not a continuous torch.                          | Screen flash requires a `ScreenFlash` and front camera.                                   |
| Low-light boost       | `enableLowLightBoostAsync(true)`              | Brightens supported preview/video/analysis streams through the camera AE path.         | CameraX 1.5.0+; query support and handle `IllegalStateException`.                         |
| Capture mode          | `ImageCapture.Builder.setCaptureMode`         | Chooses quality/latency behavior during use-case construction.                         | `MINIMIZE_LATENCY`, `MAXIMIZE_QUALITY`; ZSL is experimental/version-gated.                |
| JPEG quality          | `setJpegQuality(1..100)`                      | Changes JPEG encoding quality and therefore bytes/detail retention, not sensor pixels. | Build-time use-case option; out-of-range throws.                                          |
| Output format         | `setOutputFormat(...)`                        | Selects JPEG, Ultra HDR, RAW, or RAW+JPEG where supported.                             | Query `ImageCaptureCapabilities`; format support can change with extensions.              |
| Resolution            | `ResolutionSelector`                          | Chooses the output buffer dimensions; it is a hint constrained by the device/session.  | A larger pixel rectangle is not automatically more sensor detail.                         |
| Extension             | `ExtensionsManager`                           | OEM pipeline such as night or bokeh may combine/process frames.                        | Check availability and rebind; extension changes other supported options.                 |

CameraX's `CameraControl` operations affect the active bound camera. Zoom,
torch, focus/metering, and exposure compensation revert to defaults when it
closes; the guide does not list low-light boost, so re-query its state. Reapply
them after a rebind. Do not report a requested
value as applied until the returned future/state confirms it.

Official source: [CameraX camera controls](https://developer.android.com/media/camera/camerax/configuration#camera-output)
and [`CameraControl`](https://developer.android.com/reference/kotlin/androidx/camera/core/CameraControl).

### Zoom ratio is not preview scaling

`setZoomRatio` changes the camera crop and therefore affects all use cases that
share that crop, including `ImageCapture`. Scaling `PreviewView.scaleX/Y`
changes only the displayed view; it can preserve a full-field still, but it
does not create sensor detail and can make the preview soft. A UI that scales
the preview must map touch coordinates back through the transform before
requesting focus.

Keep these quantities separate:

| Quantity           | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| Pixel dimensions   | Width/height of the output buffer or file.                         |
| Sensor detail      | Information captured by the sensor and preserved by the pipeline.  |
| Crop               | Portion of the sensor field included in an output.                 |
| JPEG size          | Bytes after quality, content, metadata, and encoder processing.    |
| Processing latency | Time spent exposing, combining, processing, encoding, and writing. |

No resolution or zoom request guarantees a device-independent file size,
sharpness, field of view, or latency.

### Build-time versus runtime controls

| Rebuild/rebind the use case          | Can usually change after binding |
| ------------------------------------ | -------------------------------- |
| Capture mode                         | Zoom ratio/linear zoom           |
| Resolution selector/aspect ratio     | Torch                            |
| JPEG quality                         | Focus/metering                   |
| Output format                        | Exposure compensation            |
| Extension mode                       | Still flash mode                 |
| Preview/image-capture output surface | Low-light boost, when supported  |

The exact set depends on the CameraX version and device. If the setter is on a
builder, treat it as a rebind option. If it is on `CameraControl`, treat it as
an asynchronous runtime request and observe the result.

## 6. CameraX capture quality, formats, and lighting

### Capture mode and ZSL

`CAPTURE_MODE_MINIMIZE_LATENCY` favors a fast still and defaults to JPEG
quality 95. `CAPTURE_MODE_MAXIMIZE_QUALITY` favors quality and defaults to
JPEG quality 100. `CAPTURE_MODE_ZERO_SHUTTER_LAG` is version-gated and must be
checked with `CameraInfo.isZslSupported()`.

ZSL caches intermediate frames and selects the frame closest to the requested
capture time. It is not a resolution guarantee. CameraX may disable it when a
video use case, non-off flash, or OEM extension is active. Treat those as
configuration interactions, not bugs in the callback.

### Resolution and aspect ratio

`ResolutionSelector` chooses from device output sizes. A higher requested size
can increase capture time, memory pressure, and file bytes; it can also be
rejected by the simultaneous preview/analysis stream combination. CameraX's
ordinary aspect-ratio strategies are 4:3 and 16:9; use a resolution filter for
other requirements and retain a fallback unless a hard failure is intended.
`FALLBACK_RULE_NONE` fails the bind when the bound size is unavailable. The
aspect-ratio strategy outranks the resolution strategy when sizes are sorted.
OEMs may align sizes to mod 16 (1920x1088 for 1920x1080). Combining deprecated
`setTargetResolution`/`setTargetAspectRatio` with a `ResolutionSelector` throws
at `build()`. A `ViewPort` or `setCropAspectRatio` crops the saved image.

For exact Camera2 sizing, inspect `SCALER_STREAM_CONFIGURATION_MAP` and the
chosen output combination. A 1920x1080 output may be a rescale or crop of a
larger sensor readout; it does not identify the active sensor pixels by itself.

### JPEG, Ultra HDR, RAW, and RAW+JPEG

CameraX output formats are mutually exclusive for one `ImageCapture` use case.
The default is JPEG. Ultra HDR requires the format to be advertised by the
selected camera/configuration. RAW and RAW+JPEG are version-gated CameraX features; query
`ImageCaptureCapabilities.getSupportedOutputFormats()` on the configured
camera and handle a binding failure. Ultra HDR JPEG uses a gain map; selecting
it is not the same as selecting a 10-bit HDR video dynamic range. RAW output is
not a promise that every extension or HDR path remains available.

RAW/RAW+JPEG require CameraX 1.5.0+. 1.5.0-beta02 fixed RAW being reported on
devices without the RAW capability; 1.6.0-beta02 fixed in-memory RAW+JPEG. Query with the `CameraInfo` for the selected
camera (use the extension-enabled selector when applicable):

```kotlin
val formats = ImageCapture.getImageCaptureCapabilities(cameraInfo)
    .supportedOutputFormats
if (ImageCapture.OUTPUT_FORMAT_RAW_JPEG in formats) {
    val capture = ImageCapture.Builder()
        .setOutputFormat(ImageCapture.OUTPUT_FORMAT_RAW_JPEG)
        .build()
    // Bind capture with the preview before invoking takePicture.
    val rawOptions = ImageCapture.OutputFileOptions.Builder(dngFile).build()
    val jpegOptions = ImageCapture.OutputFileOptions.Builder(jpegFile).build()
    capture.takePicture(rawOptions, jpegOptions, executor, callback)
}
```

The dual-output overload takes RAW options first, JPEG second. It calls
`OnImageSavedCallback` separately for each format, in unspecified order; inspect
`OutputFileResults.imageFormat` and track both results/errors for that capture.
The single-file `takePicture(OutputFileOptions, ...)` overload throws
`IllegalArgumentException` for RAW+JPEG; the in-memory
`takePicture(Executor, OnImageCapturedCallback)` overload is valid and calls
`onCaptureSuccess` twice, in unspecified order. File options own the output
writing; there is no app-owned `ImageProxy` to close on this save-to-file path.

Sources: [`ImageCapture`](https://developer.android.com/reference/kotlin/androidx/camera/core/ImageCapture),
[`ResolutionSelector`](https://developer.android.com/reference/androidx/camera/core/resolutionselector/ResolutionSelector),
and [`ImageCapture.Builder`](https://developer.android.com/reference/androidx/camera/core/ImageCapture.Builder).

### Flash, torch, low-light boost, and extensions

Flash mode is a still-capture policy. Torch is a continuous light. They are not
interchangeable. With no flash unit, every flash mode except
`FLASH_MODE_SCREEN` acts as `FLASH_MODE_OFF`. CameraX disables auto flash on
some LEGACY devices that crash with it. Screen flash behaves like `ON`, needs a
`ScreenFlash` and the front camera, and throws `IllegalArgumentException` after
a switch to the rear camera. On current CameraX 1.7.0 release-candidate documentation,
torch and low-light boost use last-setting-wins behavior, while a still flash
can still fire with low-light boost active for preview. Earlier CameraX versions
may reject or resolve a combination differently. CameraX 1.6.2 and earlier
may require disabling one of torch/boost before enabling the other. Query the
pinned CameraX version's contract, observe failed futures, and test the device.
`enableTorch(false)` does not restore a low-light boost that the torch replaced.

Low-light boost is CameraX 1.5.0+ and Android 15/API 35+ device dependent.
Camera2's counterpart is AE mode
`CONTROL_AE_MODE_ON_LOW_LIGHT_BOOST_BRIGHTNESS_PRIORITY` (API 35); confirm it in
`CaptureResult.CONTROL_AE_MODE`, since some configurations such as high-speed
recording reject it, and read `CONTROL_LOW_LIGHT_BOOST_STATE`. A
frame-rate request above 30 FPS can disable it. Night extension combines frames
and is not the same as a continuous low-light preview boost. Extensions require
an availability check and a rebind when changing modes. CameraX 1.7.0-alpha02
deprecates `getExtensionEnabledCameraSelector` in favor of
`ExtensionSessionConfig` (1.6.0+). From November 1, 2026, apps on CameraX 1.5
or earlier lose Extensions on some devices; 1.6 and later keep them. Extensions
guarantee only `Preview` + `ImageCapture`; `ImageAnalysis` is OEM-dependent
(`isImageAnalysisSupported`), and `VideoCapture` cannot be bound with an
extension.

## 7. CameraX control recipes

### Zoom with a capability-clamped value

```kotlin
fun setZoom(camera: Camera, requested: Float, executor: Executor) {
    val state = camera.cameraInfo.zoomState.value ?: return
    val ratio = requested.coerceIn(state.minZoomRatio, state.maxZoomRatio)
    val pending = camera.cameraControl.setZoomRatio(ratio)
    pending.addListener({
        try {
            pending.get() // Listener completion alone does not mean success.
            onZoomApplied(camera.cameraInfo.zoomState.value?.zoomRatio)
        } catch (exception: Exception) {
            onControlFailed(exception)
        }
    }, executor)
}
```

Do not use a hard-coded 5x maximum. The future can fail after a lifecycle
transition; ignore only a deliberately cancelled request and surface other
failures to diagnostics.

### Focus and metering at a preview point

```kotlin
val point = previewView.meteringPointFactory
    .createPoint(xPx, yPx)
val action = FocusMeteringAction.Builder(
    point,
    FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
).setAutoCancelDuration(3, TimeUnit.SECONDS).build()
if (camera.cameraInfo.isFocusMeteringSupported(action)) {
    val pending = camera.cameraControl.startFocusAndMetering(action)
    pending.addListener({
        try {
            onFocusResult(pending.get().isFocusSuccessful)
        } catch (exception: Exception) {
            onControlFailed(exception)
        }
    }, executor)
}
```

Pass view coordinates to `PreviewView`'s factory; it accounts for `ScaleType`
and layout. Wait until the preview is `STREAMING` and the view has nonzero
size; before that the factory yields an invalid point and focus fails. Only one
focus/metering action is active; starting another cancels the earlier one (its
future fails with `OperationCanceledException`). The two-flag builder above
omits AWB; the one-argument builder defaults to AF, AE, and AWB.

### Exposure compensation and torch

```kotlin
val exposure = camera.cameraInfo.exposureState
if (exposure.isExposureCompensationSupported) {
    val index = requestedIndex.coerceIn(
        exposure.exposureCompensationRange.lower,
        exposure.exposureCompensationRange.upper
    )
    val pending = camera.cameraControl.setExposureCompensationIndex(index)
    pending.addListener({
        try { onExposureApplied(pending.get()) }
        catch (exception: Exception) { onControlFailed(exception) }
    }, executor)
}

if (camera.cameraInfo.hasFlashUnit()) {
    val pending = camera.cameraControl.enableTorch(true)
    pending.addListener({
        try {
            pending.get()
            onTorchApplied(camera.cameraInfo.torchState.value)
        } catch (exception: Exception) { onControlFailed(exception) }
    }, executor)
}
```

The exposure index is a bias to automatic exposure, not an ISO or shutter
command: EV = index × `exposureCompensationStep`. The snippets use host
callbacks; unwrap `ExecutionException.cause` for diagnostics and distinguish
intentional cancellation from failure. Dispatch UI callbacks to the UI thread
if `executor` is a background executor. `enableTorch` may fail after close. An out-of-range exposure index fails the
future with `IllegalArgumentException`.

## 8. Camera2: static characteristics and request lifecycle

Camera2 separates immutable camera characteristics from per-frame requests and
results:

1. Enumerate IDs and read characteristics.
2. Select a camera and verify permission.
3. Create every output surface (`SurfaceTexture`, `Surface`, `ImageReader`)
   before creating the capture session; each surface's size and format are
   read then. Deferred `SurfaceView`/`SurfaceTexture` outputs
   (`OutputConfiguration`, API 26+) are the exception.
4. Open `CameraDevice` with a `StateCallback`.
5. Create a session containing the exact output surfaces.
6. Build a repeating preview request targeting preview outputs.
7. Build a still request targeting still/RAW outputs and submit it with
   `session.capture` or `captureBurst`.
8. Match output images to capture results, close each image, and close the
   session/device/readers during teardown.

Requests target a subset of the surfaces configured in the session. A request
does not make an unconfigured output valid. A still request is a separate
request: copy the controls that must apply to the still; do not assume every
preview setting is inherited.

### Open the selected camera

After permission and output selection, use a serialized handler for callbacks:

```kotlin
try {
    manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
        override fun onOpened(device: CameraDevice) {
            // Host retains device, then creates the session shown below.
            configureOutputsAndSession(device)
        }

        override fun onDisconnected(device: CameraDevice) {
            device.close()
            onCameraUnavailable()
        }

        override fun onError(device: CameraDevice, error: Int) {
            device.close()
            onCameraOpenError(error)
        }
    }, cameraHandler)
} catch (exception: CameraAccessException) {
    onCameraSetupFailed(exception)
} catch (exception: SecurityException) {
    onCameraPermissionLost(exception)
}
```

The host callbacks also release session/readers and reject late `onOpened`
callbacks after teardown; closing the device alone does not close app-owned
images/readers. This is the API 21-compatible handler overload. A camera can
become unavailable even after a successful permission check, and an unknown ID
throws `IllegalArgumentException`. See
[`CameraManager.openCamera`](https://developer.android.com/reference/android/hardware/camera2/CameraManager).

### Create a session with supported outputs

```kotlin
val outputs = listOf(previewSurface, jpegReader.surface, rawReader.surface)
// Every format/size and the combination itself must be supported first.
if (Build.VERSION.SDK_INT >= 28) {
    val config = SessionConfiguration(
        SessionConfiguration.SESSION_REGULAR,
        outputs.map { OutputConfiguration(it) },
        executor,
        sessionCallback
    )
    cameraDevice.createCaptureSession(config)
} else {
    cameraDevice.createCaptureSession(outputs, sessionCallback, handler)
}
```

On API 29+, use `CameraDevice.isSessionConfigurationSupported` before creating
the session when available. On API 28, `SessionConfiguration` supplies the
structured form. On API 21–27, use the list-based overload (deprecated in API 30) and handle the
session callback failure. A list of individually valid streams is not proof
that the combined stream set is bindable.

Official sources: [`CameraDevice`](https://developer.android.com/reference/android/hardware/camera2/CameraDevice),
[multiple camera streams](https://developer.android.com/media/camera/camera2/multiple-camera-streams-simultaneously),
and [`SessionConfiguration`](https://developer.android.com/reference/android/hardware/camera2/params/SessionConfiguration).

### Repeating preview and one still request

```kotlin
val preview = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
    .apply { addTarget(previewSurface) }
session.setRepeatingRequest(preview.build(), repeatingCallback, handler)

val still = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
    .apply {
        addTarget(jpegReader.surface)
        set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
        set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
    }
session.capture(still.build(), stillCallback, handler)
```

The `still` builder is intentionally explicit. `capture()` takes priority over the
repeating request and runs after the current repeat; preview cadence may dip.
The callback is the place to record a failed
request or capture metadata. For a controlled sequence, issue the repeating
request, wait for the desired result state, submit the still request, then
restore the repeating request only if the sequence replaced or stopped it;
`capture()` itself does not stop repeating.

## 9. Camera2 manual controls

Manual controls are capability-gated. `MANUAL_SENSOR` covers sensor exposure
settings; `MANUAL_POST_PROCESSING` covers manual post-processing controls. Do
not infer support from a device brand, hardware-level enum, or a successful
read of one unrelated key.

### Manual exposure and ISO

For a manual sensor exposure, verify the characteristic ranges first, then use
`CONTROL_AE_MODE_OFF`, `SENSOR_SENSITIVITY` (ISO), and
`SENSOR_EXPOSURE_TIME` (nanoseconds). Keep `SENSOR_FRAME_DURATION` at least as
long as exposure time and the stream's required duration.

```kotlin
val request = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
request.addTarget(previewSurface)
request.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
request.set(CaptureRequest.SENSOR_SENSITIVITY, iso)
request.set(CaptureRequest.SENSOR_EXPOSURE_TIME, exposureNs)
request.set(CaptureRequest.SENSOR_FRAME_DURATION, frameDurationNs)
session.setRepeatingRequest(request.build(), callback, handler)
```

The values above are examples after range checking; they are not safe defaults
for every sensor. Manual AE can alter the behavior of auto AF and AWB. Decide
whether to disable or lock those algorithms and coordinate their state before
claiming that an exposure is manual.

### Manual focus

Set `CONTROL_AF_MODE_OFF` and use `LENS_FOCUS_DISTANCE` only when the camera
advertises `MANUAL_SENSOR`, `LENS_INFO_MINIMUM_FOCUS_DISTANCE` is greater than zero, and the device's
calibration is suitable. Zero is infinity and the device's minimum-focus-distance
value is the closest end. Values have physical diopter meaning only when
`LENS_INFO_FOCUS_DISTANCE_CALIBRATION` is `APPROXIMATE` or `CALIBRATED`;
with `UNCALIBRATED`, use the device's range without promising physical distance.
There is no universal “focus at N centimeters” setter.

```kotlin
val minDiopters = characteristics.get(
    CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE
) ?: 0f
require(minDiopters > 0f)
val distance = requestedDiopters.coerceIn(0f, minDiopters)
request.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
request.set(CaptureRequest.LENS_FOCUS_DISTANCE, distance)
```

For autofocus, issue `CONTROL_AF_TRIGGER_START` in one request, observe
`CONTROL_AF_STATE` from `TotalCaptureResult`, then return the repeating request
to `CONTROL_AF_TRIGGER_IDLE`. Use `CANCEL` to unlock/cancel an AF sequence.

### Manual white balance

The baseline API 21-compatible manual white-balance path disables AWB and
supplies the color transform and channel gains
when the device advertises manual post-processing:

```kotlin
request.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_OFF)
request.set(
    CaptureRequest.COLOR_CORRECTION_MODE,
    CaptureRequest.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX
)
request.set(CaptureRequest.COLOR_CORRECTION_GAINS, gains)
request.set(CaptureRequest.COLOR_CORRECTION_TRANSFORM, transform)
```

The `RggbChannelVector` gains and `ColorSpaceTransform` matrix must come from a
calibration or a measured policy appropriate for that camera. Never invent a
matrix and call the result calibrated.

### Auto locks and result evidence

If the product wants an auto-derived setting frozen for a still, wait for AE or
AWB convergence, verify `CONTROL_AE_LOCK_AVAILABLE` or `CONTROL_AWB_LOCK_AVAILABLE`
(characteristics, API 23+; the lock request keys exist from API 21), then lock it and observe the result. Locking is not the
same as setting a manual ISO, exposure, or white-balance value. Always inspect
the `TotalCaptureResult` keys to learn what the camera actually applied.

Official sources: [`CaptureRequest`](https://developer.android.com/reference/android/hardware/camera2/CaptureRequest),
[`CaptureResult`](https://developer.android.com/reference/android/hardware/camera2/CaptureResult),
and [`CameraCharacteristics`](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics).

## 10. Camera2 zoom, flash, and processing

### Zoom

On API 30+, use `CONTROL_ZOOM_RATIO` within
`CONTROL_ZOOM_RATIO_RANGE`. Leave `SCALER_CROP_REGION` at its default active
array when using zoom ratio; with a ratio other than 1.0 it may only letterbox
or pillarbox. The range key is optional (LIMITED and above list it). A ratio
below 1.0 zooms out where supported; crop region cannot. On older APIs, use `SCALER_CROP_REGION` within
`SCALER_AVAILABLE_MAX_DIGITAL_ZOOM` and the active-array/cropping rules. Do not
set both zoom ratio and a competing crop policy in the same request.

Zoom ratio can combine optical and digital behavior on a logical multi-camera
device. It still changes the field of view of the targeted output streams. RAW
is not generally cropped unless the device advertises the relevant cropped-RAW
stream use case (`SCALER_AVAILABLE_STREAM_USE_CASES_CROPPED_RAW`, API 34).

### Flash and torch

Camera2 flash behavior is expressed through available flash/AE modes and the
device's characteristics. A torch is a device/characteristic-supported
continuous light mode; a still flash is part of the still request. Query
`FLASH_INFO_AVAILABLE` and the relevant AE modes. Do not assume a front camera
has a flash unit merely because the rear camera does.

| Intent                            | Camera2 request settings, after checking supported modes |
| --------------------------------- | -------------------------------------------------------- |
| Automatic still flash             | `CONTROL_AE_MODE_ON_AUTO_FLASH`                          |
| Always-flash still with AE        | `CONTROL_AE_MODE_ON_ALWAYS_FLASH`                        |
| Continuous torch with ordinary AE | `CONTROL_AE_MODE_ON` plus `FLASH_MODE_TORCH`             |
| No flash with ordinary AE         | `CONTROL_AE_MODE_ON` plus `FLASH_MODE_OFF`               |

The first two are values of `CONTROL_AE_MODE`, not `FLASH_MODE`. Automatic
flash decisions belong to AE; `FLASH_MODE` can be ignored in AE flash modes.
For a flash still, follow the AE precapture sequence and wait for result states
before capture. Simply adding `FLASH_MODE_SINGLE` does not implement a complete
auto-flash sequence. See [`CaptureRequest`](https://developer.android.com/reference/android/hardware/camera2/CaptureRequest).

### Noise reduction and edge processing

`NOISE_REDUCTION_MODE` and `EDGE_MODE` are optional keys with device-advertised
available values. `HIGH_QUALITY` may reduce capture rate;
`FAST` never does and may equal `OFF` (edge) or `MINIMAL`/`OFF` (noise
reduction). Only noise reduction states a RAW-domain effect (`MINIMAL` is
raw-domain; `OFF` covers raw and YUV); `EDGE_MODE` states none. Do not describe
a JPEG sharpening choice as sensor detail.
Check each available-mode list for `null`: noise-reduction modes are listed on
LIMITED and above (LEGACY supports only `FAST`); both keys are guaranteed on
FULL. `ZERO_SHUTTER_LAG` modes leave high-resolution streams unprocessed, so
they suit app-side ZSL reprocessing, not a plain still.

## 11. RAW capture and DNG output with Camera2

RAW requires all of the following:

1. `REQUEST_AVAILABLE_CAPABILITIES_RAW` in the selected camera's capabilities.
2. A `RAW_SENSOR` output size from the stream configuration map.
3. A session combination that supports the preview/JPEG/RAW outputs together.
4. An `ImageReader` configured with `ImageFormat.RAW_SENSOR`.
5. A capture result matched to the exact RAW image.

`RAW_SENSOR` is usually a single-channel 16-bit Bayer mosaic. The largest RAW
size equals `SENSOR_INFO_PIXEL_ARRAY_SIZE` or
`SENSOR_INFO_PRE_CORRECTION_ACTIVE_ARRAY_SIZE`. Several controls skip RAW:
`CONTROL_POST_RAW_SENSITIVITY_BOOST`, zoom-ratio cropping (without
`CROPPED_RAW`, API 34), distortion correction, and rotate-and-crop.
`HOT_PIXEL_MODE`, `BLACK_LEVEL_LOCK`, and `SENSOR_INFO_LENS_SHADING_APPLIED`
change or describe RAW-domain processing. Enable lens-shading-map output for
DNG; RAW-capable devices always support it. Camera2 `CONTROL_SCENE_MODE_HDR`
does not support a RAW output. In a reprocessable session, app-side ZSL
reprocessing and DNG capture cannot share one request. Outside the mandatory
stream-use-case lists, leave RAW stream use cases `DEFAULT`.

`ImageReader` images carry a timestamp. Match the image timestamp to
`TotalCaptureResult.SENSOR_TIMESTAMP` from the corresponding request; do not
pair “the next result” by arrival order. Timestamps are identical across a
capture's outputs under the default timestamp base;
`OutputConfiguration.setTimestampBase` (API 33) can change an output's base. Bound the pending-result map and clean
it on timeout, reader error, session close, and device close.

```kotlin
val rawReader = ImageReader.newInstance(
    rawWidth,
    rawHeight,
    ImageFormat.RAW_SENSOR,
    2 // small bounded queue; choose for the pipeline, not convenience
)
// Configure rawReader.surface in the session and target it in the still request.

// Invoke ONLY after matching both callbacks by sensor timestamp.
fun writeMatchedDng(image: Image, result: TotalCaptureResult, dngFile: File) {
    image.use { raw ->
        require(raw.timestamp == result.get(CaptureResult.SENSOR_TIMESTAMP))
        FileOutputStream(dngFile).use { stream ->
            DngCreator(characteristics, result).use { dng ->
                dng.writeImage(stream, raw)
            }
        }
    }
}
```

The fragment assumes valid `characteristics`, imports from `android.media`,
`android.hardware.camera2`, and `java.io`, and a timestamp matcher owned by the
capture session. That matcher must accept either callback first: queue the
`Image` from `acquireNextImage()` and the `TotalCaptureResult` separately, then
remove and write the pair when both are present. A missing result at the moment
the image callback arrives is normal; do not throw or discard the image merely
because the other callback has not arrived yet. Bound both queues, use a timeout,
and close every unmatched image on failure/teardown. Handle DNG write errors and
delete incomplete files; do not leave exceptions unhandled on the camera thread.
Close the reader after the session/device has stopped output. `writeImage`
requires RAW_SENSOR pixels. The helper demonstrates writing an already-matched
pair, not a complete asynchronous matching implementation.

Official sources: [`DngCreator`](https://developer.android.com/reference/android/hardware/camera2/DngCreator),
[`ImageReader`](https://developer.android.com/reference/android/media/ImageReader),
[`RAW_SENSOR`](https://developer.android.com/reference/android/graphics/ImageFormat#RAW_SENSOR),
and [`CaptureResult.SENSOR_TIMESTAMP`](https://developer.android.com/reference/android/hardware/camera2/CaptureResult#SENSOR_TIMESTAMP).

## 12. CameraX and Camera2 interop

CameraX interop is appropriate when CameraX should still own lifecycle, use
cases, surfaces, and capture delivery, but a Camera2 key is needed for a
specific use case. Apply an interop option to the use-case builder before
`build()` and test whether CameraX's own `CameraControl` or 3A logic will
overwrite or conflict with it.

```kotlin
@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
fun captureWithNoiseReduction(mode: Int): ImageCapture {
    // Check NOISE_REDUCTION_AVAILABLE_NOISE_REDUCTION_MODES first.
    val builder = ImageCapture.Builder()
    Camera2Interop.Extender(builder).setCaptureRequestOption(
        CaptureRequest.NOISE_REDUCTION_MODE, mode
    )
    return builder.build()
}
```

The fragment assumes a pinned CameraX version that still exposes
`Camera2Interop.Extender`. AndroidX Camera 1.7.0-alpha03 (reference pages stamp
1.7.0-rc02) deprecates the older
Extender/Camera2CameraControl surface in favor of builder `camera2Interop` and
runtime `applyCamera2Interop` / `applyCamera2InteropAsync`; use the API present
in the version actually pinned by the app and do
not copy an alpha/RC API into a 1.6.x build. Interop values can override
CameraX-internal values, and still-capture options can override repeating
options for the same key. Avoid interop for controls that CameraX already
owns unless the interaction is intentional and tested.

For CameraX 1.6.x, runtime overrides use the experimental
`Camera2CameraControl` and `CaptureRequestOptions` APIs:

```kotlin
val camera2 = Camera2CameraControl.from(camera.cameraControl)
val options = CaptureRequestOptions.Builder()
    .setCaptureRequestOption(CaptureRequest.CONTROL_AWB_LOCK, true)
    .build()
val pending = camera2.setCaptureRequestOptions(options)
// Observe pending completion with get()/error handling, as in the control recipes.
// Later, when restoring CameraX ownership:
val restored = camera2.clearCaptureRequestOptions()
```

Put this fragment in an `@OptIn(ExperimentalCamera2Interop::class)` scope and
check AWB-lock availability first. `setCaptureRequestOptions` replaces the
current override set; `addCaptureRequestOptions` merges. Overrides affect
repeating and single captures. Do not issue set/clear back-to-back as a control
operation: clear at the later mode transition and observe that future too.

Official sources: [`Camera2Interop.Extender`](https://developer.android.com/reference/kotlin/androidx/camera/camera2/interop/Camera2Interop.Extender),
[`Camera2CameraControl`](https://developer.android.com/reference/androidx/camera/camera2/interop/Camera2CameraControl),
and [camera2 interop package](https://developer.android.com/reference/kotlin/androidx/camera/camera2/interop/package-summary).

## 13. Controls and effects interaction matrix

This matrix describes decisions to make before exposing controls. “May” means
the result is version/device dependent; a capability check and a capture-result
or callback check are required.

| Combination                             | Expected interaction                                                            | Safe implementation rule                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| CameraX ZSL + non-off flash             | ZSL may be disabled.                                                            | Query ZSL support and do not promise zero shutter lag.                      |
| CameraX ZSL + extension                 | ZSL may be disabled.                                                            | Recompute capabilities with the extension enabled.                          |
| CameraX ZSL + video                     | ZSL may be disabled.                                                            | Choose a capture mode that remains valid for all bound use cases.           |
| CameraX torch + flash                   | Torch stays on during capture whatever the flash mode; flash applies only with torch off. | Keep torch and flash as separate UI/state values; observe result.           |
| CameraX torch + low-light boost         | Last-setting-wins behavior in current 1.7.0 RC docs; older versions may reject. | Gate by pinned version, handle failed future, and test device.              |
| CameraX low-light boost + flash         | Current 1.7.0 RC docs allow still flash while boost remains preview-active.     | Do not apply an older blanket conflict rule to every CameraX version.       |
| CameraX boost + frame rate above 30 FPS | Boost may disable.                                                              | Read support/state after frame-rate configuration.                          |
| CameraX extension + Ultra HDR/RAW       | Supported formats can change.                                                   | Query formats after extension selection and rebind.                         |
| CameraX view scaling + sensor zoom      | Independent transforms can double-crop or mis-map focus.                        | Choose one owner for field-of-view behavior and map coordinates explicitly. |
| Camera2 manual AE + auto AF/AWB         | Automatic algorithms may change or stop converging.                             | Disable or lock them intentionally and verify result states.                |
| Camera2 AF trigger + repeating request  | A trigger is one-shot state, not a repeating mode.                              | START once, observe state, return to IDLE; CANCEL to unlock.                |
| Camera2 zoom ratio + crop region        | They compose: with zoom ratio set, crop region uses post-zoom coordinates.      | Use ratio on API 30+ with default crop; crop on older APIs.                 |
| Camera2 RAW + crop                      | RAW is usually full sensor field.                                               | Require the device's cropped-RAW support before claiming crop.              |
| Camera2 RAW + JPEG                      | Both outputs must be in the session and matched independently.                  | Pair by capture ID/timestamp and close both images.                         |
| Camera2 stream sizes                    | Individually valid streams can fail as a combination.                           | Validate the exact combination before session creation.                     |
| Any request + lifecycle close           | Futures/callbacks can complete after teardown.                                  | Make callbacks idempotent and ignore stale owners.                          |

## 14. Version and API gates

| Feature                          | Gate to document and check                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Camera2 API                      | Platform API is available from API 21; individual keys and session forms have their own API levels. |
| Camera2 `SessionConfiguration`   | API 28; `isSessionConfigurationSupported` is API 29.                                                |
| Camera2 zoom ratio               | API 30; use crop region on earlier APIs.                                                            |
| Camera2 physical camera IDs      | API 28.                                                                                             |
| Camera2 AE/AWB lock availability | API 23 `*_LOCK_AVAILABLE` characteristics; lock request keys API 21.                                |
| CameraX resolution selector      | CameraX 1.3.0+ APIs; keep a fallback.                                                               |
| CameraX JPEG quality             | CameraX 1.1.0+ API.                                                                                 |
| CameraX output format selector   | CameraX 1.4.0+ for JPEG/Ultra HDR (experimental in 1.4.x); RAW/RAW+JPEG require 1.5.0+.             |
| CameraX screen flash             | CameraX 1.4.0+; front camera and a `ScreenFlash` required.                                          |
| Camera2 cropped-RAW use case     | API 34 (`SCALER_AVAILABLE_STREAM_USE_CASES_CROPPED_RAW`).                                           |
| CameraX low-light boost          | CameraX 1.5.0+, Android 15/API 35+ capable devices; query support.                                  |
| CameraX ZSL                      | CameraX 1.2.0+ experimental mode and device support.                                                |
| CameraX interop APIs             | Check the pinned version; older interop surfaces deprecated from 1.7.0-alpha03 (reference: rc02).   |
| CameraX Extensions               | CameraX 1.6+ to keep Extensions on all devices after 2026-11-01; `ExtensionSessionConfig` 1.6.0+.   |
| CameraX `ImageAnalysis` PRIVATE  | Reference marks `PRIVATE` and `getImageAnalysisCapabilities` "Added in 1.7.0-rc02"; NV21 1.5.0.     |
| Ultra HDR                        | Device support and Android API 34+ requirements apply in addition to CameraX support.               |

Alpha releases may add, remove, or change APIs; an RC's API surface is final.
Release notes and reference "Added in" markers can name different versions;
confirm the API in the pinned binary. Do not fill this table with an arbitrary
“latest CameraX” version. Read the
project's dependency lock/build output, then verify the API in that version's
official reference. A version gate is useful only when it matches the binary
actually shipped.

## 15. Testing what the camera actually applied

### Capability and setup checks

- Record camera ID, lens facing, API level, hardware level, capability enums,
  supported output sizes, formats, zoom range, flash availability, and the
  CameraX library version.
- Test permission denial, lifecycle stop/start, detach/attach, lens switch,
  and rebind while a capture callback is pending.
- Confirm every output surface was configured before session creation.

### Control-result checks

- For CameraX, record the requested value, callback/future outcome, and the
  resulting `CameraInfo` state. A requested zoom is not proof of applied zoom.
- For Camera2, record request ID/frame number, `TotalCaptureResult` states,
  exposure time, ISO, focus distance, AWB/AE modes/locks, crop or zoom ratio,
  and sensor timestamp.
- For RAW, prove the `Image.timestamp` matched the selected result timestamp
  and that the DNG writer completed before closing the image.

### Quality, latency, and file checks

- Measure shutter-to-callback latency over repeated captures; report median and
  tail, not one favorable frame.
- Compare dimensions, EXIF orientation, MIME type, JPEG byte size, and decoded
  image content at each requested resolution/quality.
- Compare field of view at 1x and zoomed capture separately from preview
  scaling. Verify whether the saved photo is sensor-cropped or full-field.
- Test low light, bright light, moving subjects, flash/torch transitions,
  extension enabled/disabled, and thermal or memory pressure.
- Test a supported device and at least one device that lacks each optional
  capability. “Unsupported” must be a handled outcome, not an app crash.

### Evidence boundary

Source review, a successful bind, and a callback are not visual quality proof.
A native compile proves API signatures, not device behavior. A device drive
proves only the tested device/configuration. Keep those claims separate in the
test record.

## 16. Short decision checklist

Before adding a camera control, answer these in the implementation note:

1. Which owner opens the camera: CameraX or direct Camera2?
2. Which lifecycle owns it, and what happens on stop/detach/rebind?
3. What permission and output storage path are required?
4. Which capability key/query gates the control?
5. Is it a use-case build/rebind option or an asynchronous runtime control?
6. Does it change the sensor crop, output dimensions, JPEG encoding, or only
   the displayed preview?
7. Which other controls can disable, override, or change its capability?
8. What callback/result proves what the device actually applied?
9. What is the API level and pinned CameraX version gate?
10. Which real device and unsupported-device paths were driven?
