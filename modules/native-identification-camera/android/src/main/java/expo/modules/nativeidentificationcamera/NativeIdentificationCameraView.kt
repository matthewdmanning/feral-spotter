package expo.modules.nativeidentificationcamera

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.util.Range
import android.view.ScaleGestureDetector
import android.view.ViewGroup
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.SessionConfig
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.UUID

/**
 * The Android half of the camera seam: this view owns the CameraX session and
 * nothing else. Captured-photo state, upload, gallery save and analytics belong
 * to the React Native layer.
 *
 * Why CameraX and not Camera2: this screen needs a preview and image capture,
 * which CameraX exposes as use cases bound to an Android lifecycle, and CameraX
 * handles the session, threading and device-quirk work that a Camera2
 * implementation would have to reproduce. Android recommends CameraX unless the
 * app needs a low-level Camera2 capability.
 *
 * OPEN GATE — whether that stays true depends on identification work that has
 * not been decided. If an on-device denoiser or a bounding-box detector needs a
 * RAW artifact, Camera2 may become necessary. Before replacing CameraX, write
 * down: the required artifact (DNG alone, or JPEG plus DNG); whether
 * motion-priority and zero-shutter-lag must stay enabled alongside it; which
 * downstream step consumes each file; and the exact CameraX capability or
 * output-mode combination that blocks the requirement. Query CameraX's runtime
 * output-format set and validate the chosen mode on representative physical
 * devices rather than assuming from the documentation.
 */
@SuppressLint("ViewConstructor")
class NativeIdentificationCameraView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  val onCameraReady by EventDispatcher()
  val onCameraError by EventDispatcher()

  /**
   * Session diagnostics for a profiling or test-drive run. The view does not
   * talk to an analytics SDK: it reports what the session did and the React
   * Native layer decides whether that reaches PostHog, so there is one consent
   * gate and one distinct id rather than a second, native set of both.
   */
  val onCameraDiagnostic by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }

  private val scaleGestureDetector = ScaleGestureDetector(
    context,
    object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
      override fun onScale(detector: ScaleGestureDetector): Boolean {
        val boundCamera = camera ?: return false
        val zoomState = boundCamera.cameraInfo.zoomState.value ?: return false
        val requested = zoomState.zoomRatio * detector.scaleFactor
        boundCamera.cameraControl.setZoomRatio(
          requested.coerceIn(zoomState.minZoomRatio, zoomState.maxZoomRatio)
        )
        return true
      }

      // One event per pinch, not one per frame of it. A run that shows both
      // pinch_ended and focus_requested is the evidence that the touch listener
      // lets tap and pinch coexist.
      override fun onScaleEnd(detector: ScaleGestureDetector) {
        diagnostic(
          "pinch_ended",
          mapOf(
            // -1 means the session went away before the pinch ended.
            "zoom_ratio" to
              (camera?.cameraInfo?.zoomState?.value?.zoomRatio?.toDouble() ?: -1.0),
            "camera_position" to position
          )
        )
      }
    }
  )

  private var cameraProvider: ProcessCameraProvider? = null

  // Written on the main thread from bindCamera/unbindCamera and read by capture
  // and focus, which arrive on an Expo async caller's thread. @Volatile makes
  // that read see the latest write; capture additionally hops to the main
  // thread before it touches CameraX, matching the explicit session-queue hops
  // the iOS view makes.
  @Volatile
  private var boundSessionConfig: SessionConfig? = null

  @Volatile
  private var imageCaptureUseCase: ImageCapture? = null

  @Volatile
  private var camera: Camera? = null

  // Prop setters record that a rebind is needed rather than performing one.
  // Expo calls OnViewDidUpdateProps once after a whole prop batch, so two
  // settings changed together now cost one session teardown instead of two.
  private var needsRebind = false

  var isActive: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      needsRebind = true
    }

  var position: String = "back"
    set(value) {
      val normalized = if (value == "front") "front" else "back"
      if (field == normalized) return
      field = normalized
      needsRebind = true
    }

  var maxDetail: Boolean = true
    set(value) {
      if (field == value) return
      field = value
      needsRebind = true
    }

  var motionPriority: Boolean = true
    set(value) {
      if (field == value) return
      field = value
      needsRebind = true
    }

  var disableLowLightBoost: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      if (value) camera?.let(::disableLowLightBoostIfSupported)
    }

  var subjectMetering: Boolean = false

  /**
   * Driven by the `camera_performance_checks` setting. Off by default, so a
   * normal install reports nothing from here.
   */
  var diagnostics: Boolean = false

  private val tuning: CaptureTuning
    get() = CaptureTuning.of(maxDetail, motionPriority)

  /**
   * How many times this view has bound a session. A cold mount should report 1,
   * and a prop batch that changes several tuning settings at once should add
   * exactly 1 more — which is the whole point of the deferred rebind.
   */
  private var bindCount = 0

  private fun diagnostic(event: String, fields: Map<String, Any> = emptyMap()) {
    if (!diagnostics) return
    onCameraDiagnostic(mapOf("event" to event) + fields)
  }

  init {
    addView(previewView)
    previewView.setOnTouchListener { _, event ->
      scaleGestureDetector.onTouchEvent(event)
      // Consume the gesture only while a pinch is actually in progress.
      // Returning true for everything except ACTION_UP swallowed ACTION_DOWN,
      // so React Native's responder system never saw the gesture start and no
      // JS touch handler on the preview could fire — which is what tap to
      // focus needs.
      scaleGestureDetector.isInProgress
    }

    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      try {
        cameraProvider = future.get()
        if (isActive) bindCamera()
      } catch (error: Throwable) {
        onCameraError(mapOf("message" to (error.message ?: error.toString())))
      }
    }, ContextCompat.getMainExecutor(context))
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int
  ) {
    super.onLayout(changed, left, top, right, bottom)
    previewView.layout(0, 0, right - left, bottom - top)
  }

  /**
   * Applies whatever the last prop batch changed, as one session operation.
   * Called from the module's OnViewDidUpdateProps.
   */
  fun applyPendingConfiguration() {
    if (!needsRebind) return
    needsRebind = false
    if (!isActive) {
      unbindCamera()
      return
    }
    post {
      unbindCamera()
      bindCamera()
    }
  }

  private fun buildImageCapture(tuning: CaptureTuning): ImageCapture {
    val builder = ImageCapture.Builder()

    if (tuning.prefersHighestResolution()) {
      val selector = ResolutionSelector.Builder()
        .setAllowedResolutionMode(
          ResolutionSelector.PREFER_HIGHER_RESOLUTION_OVER_CAPTURE_RATE
        )
        .setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)
        .build()
      builder.setResolutionSelector(selector)
    }

    builder.setCaptureMode(tuning.captureMode())

    return builder.build()
  }

  /**
   * CameraX can only report supported frame rate ranges for a SessionConfig, so
   * asking the question costs one config object. When no range is preferred the
   * probe is returned as the real config rather than built a second time.
   */
  private fun buildSessionConfig(
    provider: ProcessCameraProvider,
    selector: CameraSelector,
    preview: Preview,
    imageCapture: ImageCapture,
    tuning: CaptureTuning
  ): SessionConfig {
    val builder = SessionConfig.Builder(preview, imageCapture)
    if (!tuning.prefersFrameRateRange()) return builder.build()

    val probeConfig = builder.build()
    val supportedRanges = provider
      .getCameraInfo(selector)
      .getSupportedFrameRateRanges(probeConfig)
    val preferredRange = supportedRanges.maxWithOrNull(
      compareBy<Range<Int>> { it.lower }.thenBy { it.upper }
    ) ?: return probeConfig

    builder.setFrameRateRange(preferredRange)
    return builder.build()
  }

  private fun bindCamera() {
    val provider = cameraProvider ?: return
    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner ?: run {
      onCameraError(mapOf("message" to "Camera activity is not a LifecycleOwner"))
      return
    }

    val startedAt = System.currentTimeMillis()
    try {
      val activeTuning = tuning
      val selector = CameraSelector.Builder()
        .requireLensFacing(
          if (position == "front") {
            CameraSelector.LENS_FACING_FRONT
          } else {
            CameraSelector.LENS_FACING_BACK
          }
        )
        .build()

      val preview = Preview.Builder().build().also {
        it.surfaceProvider = previewView.surfaceProvider
      }
      val imageCapture = buildImageCapture(activeTuning)
      val sessionConfig = buildSessionConfig(
        provider,
        selector,
        preview,
        imageCapture,
        activeTuning
      )

      val boundCamera = provider.bindToLifecycle(
        lifecycleOwner,
        selector,
        sessionConfig
      )

      boundSessionConfig = sessionConfig
      imageCaptureUseCase = imageCapture
      camera = boundCamera
      if (disableLowLightBoost) {
        disableLowLightBoostIfSupported(boundCamera)
      }
      // The resolved tuning is reported so an on-device profiling run can tell
      // which capture mode actually ran, rather than inferring it from settings.
      onCameraReady(
        mapOf(
          "captureTuning" to activeTuning.telemetryName,
          "captureMode" to activeTuning.captureMode()
        )
      )

      bindCount += 1
      diagnostic(
        "session_bound",
        mapOf(
          "bind_count" to bindCount,
          "capture_tuning" to activeTuning.telemetryName,
          "capture_mode" to activeTuning.captureMode(),
          "camera_position" to position,
          "max_detail" to maxDetail,
          "motion_priority" to motionPriority,
          "low_light_boost_disabled" to disableLowLightBoost,
          "low_light_boost_supported" to boundCamera.cameraInfo.isLowLightBoostSupported,
          "bind_duration_ms" to (System.currentTimeMillis() - startedAt)
        )
      )
    } catch (error: Throwable) {
      onCameraError(mapOf("message" to (error.message ?: error.toString())))
      diagnostic(
        "session_bind_failed",
        mapOf(
          "message" to (error.message ?: error.toString()),
          "camera_position" to position,
          "bind_duration_ms" to (System.currentTimeMillis() - startedAt)
        )
      )
    }
  }

  private fun unbindCamera() {
    val provider = cameraProvider ?: return
    val wasBound = boundSessionConfig != null
    boundSessionConfig?.let { provider.unbind(it) }
    boundSessionConfig = null
    imageCaptureUseCase = null
    camera = null
    if (wasBound) {
      diagnostic("session_unbound", mapOf("bind_count" to bindCount))
    }
  }

  /**
   * Low-light boost brightens the preview by lengthening exposure, which blurs
   * a moving animal. Turning it off is opt-in, and only where the device says
   * it supports the control at all.
   */
  private fun disableLowLightBoostIfSupported(boundCamera: Camera) {
    if (!boundCamera.cameraInfo.isLowLightBoostSupported) return
    boundCamera.cameraControl.enableLowLightBoostAsync(false)
  }

  fun capture(options: NativeCaptureOptions, promise: Promise) {
    // CameraX use cases are bound on the main thread, so the capture request
    // joins them there instead of touching them from the caller's thread.
    post {
      val imageCapture = imageCaptureUseCase ?: run {
        promise.reject("ERR_CAMERA_NOT_READY", "Camera is not ready", null)
        return@post
      }

      imageCapture.flashMode = when (options.flashMode) {
        "on" -> ImageCapture.FLASH_MODE_ON
        "auto" -> ImageCapture.FLASH_MODE_AUTO
        else -> ImageCapture.FLASH_MODE_OFF
      }

      val outputFile = File(context.cacheDir, "${UUID.randomUUID()}.jpg")
      val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
      val requestedAt = System.currentTimeMillis()

      imageCapture.takePicture(
        outputOptions,
        ContextCompat.getMainExecutor(context),
        object : ImageCapture.OnImageSavedCallback {
          override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
            resolveWithFileDimensions(outputFile, promise, requestedAt)
          }

          override fun onError(exception: ImageCaptureException) {
            promise.reject("ERR_CAPTURE_FAILED", exception.message, exception)
            diagnostic(
              "capture_failed",
              mapOf(
                "message" to (exception.message ?: exception.toString()),
                "image_capture_error_code" to exception.imageCaptureError,
                "elapsed_ms" to (System.currentTimeMillis() - requestedAt)
              )
            )
          }
        }
      )
    }
  }

  /**
   * Reads the dimensions from the file that was just written, rather than from
   * imageCapture.resolutionInfo. resolutionInfo is null until the use case
   * attaches, which includes the window after any rebind, and the previous
   * fallback reported a photo of size 0x0 all the way to the upload.
   *
   * The stored pixels are unrotated, so the EXIF orientation decides whether
   * the axes are swapped for a consumer that honours it.
   */
  private fun resolveWithFileDimensions(
    outputFile: File,
    promise: Promise,
    requestedAt: Long
  ) {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(outputFile.absolutePath, bounds)

    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      promise.reject(
        "ERR_CAPTURE_NO_DIMENSIONS",
        "Saved capture reported no dimensions",
        null
      )
      diagnostic(
        "capture_no_dimensions",
        mapOf("elapsed_ms" to (System.currentTimeMillis() - requestedAt))
      )
      return
    }

    var exifOrientation = ExifInterface.ORIENTATION_UNDEFINED
    val quarterTurned = try {
      exifOrientation = ExifInterface(outputFile.absolutePath).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )
      when (exifOrientation) {
        ExifInterface.ORIENTATION_ROTATE_90, ExifInterface.ORIENTATION_ROTATE_270 -> true
        ExifInterface.ORIENTATION_TRANSPOSE, ExifInterface.ORIENTATION_TRANSVERSE -> true
        else -> false
      }
    } catch (error: Throwable) {
      // An unreadable EXIF block is not a reason to fail the capture; the
      // unrotated bounds are still usable.
      false
    }

    val reportedWidth = if (quarterTurned) bounds.outHeight else bounds.outWidth
    val reportedHeight = if (quarterTurned) bounds.outWidth else bounds.outHeight

    promise.resolve(
      mapOf(
        "uri" to android.net.Uri.fromFile(outputFile).toString(),
        "width" to reportedWidth,
        "height" to reportedHeight
      )
    )

    // Both the stored and the reported axes, so the EXIF swap can be checked
    // against a real portrait capture instead of inferred from the photo.
    diagnostic(
      "capture_saved",
      mapOf(
        "stored_width" to bounds.outWidth,
        "stored_height" to bounds.outHeight,
        "reported_width" to reportedWidth,
        "reported_height" to reportedHeight,
        "exif_orientation" to exifOrientation,
        "axes_swapped" to quarterTurned,
        "file_bytes" to outputFile.length(),
        "camera_position" to position,
        "capture_tuning" to tuning.telemetryName,
        "elapsed_ms" to (System.currentTimeMillis() - requestedAt)
      )
    )
  }

  fun focus(normalizedX: Double, normalizedY: Double): Boolean {
    // Reported whether or not it is applied: a tap that arrives but is refused
    // looks identical on screen to a tap that never arrived.
    fun report(accepted: Boolean, reason: String) {
      diagnostic(
        "focus_requested",
        mapOf(
          "accepted" to accepted,
          "reason" to reason,
          "normalized_x" to normalizedX,
          "normalized_y" to normalizedY,
          "subject_metering" to subjectMetering,
          "camera_position" to position
        )
      )
    }

    if (normalizedX !in 0.0..1.0 || normalizedY !in 0.0..1.0) {
      report(false, "out_of_bounds")
      return false
    }
    val boundCamera = camera ?: run {
      report(false, "no_bound_camera")
      return false
    }
    if (previewView.width <= 0 || previewView.height <= 0) {
      report(false, "preview_not_measured")
      return false
    }

    val point = previewView.meteringPointFactory.createPoint(
      (normalizedX * previewView.width).toFloat(),
      (normalizedY * previewView.height).toFloat()
    )
    val action = FocusMeteringAction.Builder(
      point,
      FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
    ).build()
    boundCamera.cameraControl.startFocusAndMetering(action)
    report(true, "started")
    return true
  }

  fun setSubjectRegion(region: NativeSubjectRegion?): Boolean {
    if (!subjectMetering || region == null) {
      // Without this, a run with camera_subject_metering off is silent and
      // looks the same as a tap that never reached the view at all.
      diagnostic(
        "subject_region_ignored",
        mapOf(
          "subject_metering" to subjectMetering,
          "region_present" to (region != null)
        )
      )
      return false
    }
    return focus(
      region.x + region.width / 2.0,
      region.y + region.height / 2.0
    )
  }

  override fun onDetachedFromWindow() {
    unbindCamera()
    super.onDetachedFromWindow()
  }
}
