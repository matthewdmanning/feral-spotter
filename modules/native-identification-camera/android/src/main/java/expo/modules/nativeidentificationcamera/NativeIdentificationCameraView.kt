package expo.modules.nativeidentificationcamera

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.TotalCaptureResult
import android.media.ExifInterface
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.util.Log
import android.util.Range
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
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
import androidx.tracing.Trace
import androidx.tracing.trace
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Perfetto section and counter names, and the logcat tag, for the startup to
 * first-capture benchmark. Each name has the same prefix so a trace can be
 * filtered to this view.
 */
private const val PERF_TAG = "FeralCamPerf"
private const val SECTION_PROVIDER = "FeralCam:providerReady"
private const val SECTION_BIND = "FeralCam:bindCamera"
private const val SECTION_UNBIND = "FeralCam:unbindCamera"
private const val SECTION_FIRST_FRAME = "FeralCam:bindToFirstFrame"
private const val SECTION_CAPTURE = "FeralCam:capture"
private const val SECTION_RESOLVE = "FeralCam:resolveDimensions"
private const val COUNTER_FRAME_INTERVAL = "FeralCam:frameIntervalUs"

/** Milliseconds since this process was forked, the zero point of a cold start. */
private fun msSinceProcessStart(): Long =
  SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime()

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

  // Pinch to zoom is a view zoom: the PreviewView is scaled on screen and the
  // sensor stays at 1x. CameraX zoom crops every bound use case, so a sensor
  // zoom would crop the saved photo too. The photo must stay full field and
  // full resolution, so the zoom here only magnifies what the user looks at.
  // The zoom always centres on the preview. The scale is kept in `viewZoom`, an
  // immutable value read by focus on a caller's thread, and copied onto
  // previewView by applyViewZoom. Its limits are the one place the zoom range
  // is set.
  @Volatile
  private var viewZoom = ViewZoom.initial()

  private val scaleGestureDetector = ScaleGestureDetector(
    context,
    object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
      override fun onScale(detector: ScaleGestureDetector): Boolean {
        applyViewZoom(viewZoom.scaledBy(detector.scaleFactor))
        return true
      }

      // One event per pinch, not one per frame of it. A run that shows both
      // pinch_ended and focus_requested is the evidence that the touch listener
      // lets tap and pinch coexist.
      override fun onScaleEnd(detector: ScaleGestureDetector) {
        diagnostic(
          "pinch_ended",
          mapOf(
            "view_zoom" to viewZoom.scale.toDouble(),
            // Stays 1.0 if the photo is still full field. -1 means the session
            // went away before the pinch ended.
            "sensor_zoom_ratio" to
              (camera?.cameraInfo?.zoomState?.value?.zoomRatio?.toDouble() ?: -1.0),
            "camera_position" to position
          )
        )
      }
    }
  )

  // The current multiplier, such as "2.3x", shown only while zoomed in.
  private val zoomLabel = TextView(context).apply {
    visibility = View.GONE
    setTextColor(Color.WHITE)
    textSize = ZOOM_LABEL_TEXT_SP
    val density = context.resources.displayMetrics.density
    val padding = (ZOOM_LABEL_PADDING_DP * density).toInt()
    setPadding(padding * 2, padding, padding * 2, padding)
    background = GradientDrawable().apply {
      setColor(ZOOM_LABEL_BACKGROUND)
      cornerRadius = ZOOM_LABEL_RADIUS_DP * density
    }
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  private fun applyViewZoom(zoom: ViewZoom) {
    viewZoom = zoom
    previewView.scaleX = zoom.scale
    previewView.scaleY = zoom.scale
    val zoomed = pinchZoom && zoom.isZoomed
    zoomLabel.visibility = if (zoomed) View.VISIBLE else View.GONE
    if (zoomed) zoomLabel.text = String.format(Locale.US, "%.1f×", zoom.scale)
  }

  private fun resetViewZoom() = applyViewZoom(viewZoom.reset())

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

  // A rebind is posted rather than run inline, so a second caller arriving
  // before the post runs must not queue a second teardown and bind.
  private var rebindScheduled = false

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

  var pinchZoom: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      previewView.implementationMode = if (value) {
        PreviewView.ImplementationMode.COMPATIBLE
      } else {
        PreviewView.ImplementationMode.PERFORMANCE
      }
      if (!value) resetViewZoom()
      needsRebind = true
    }

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

  // Profiling is on only when the build is profileable (see
  // plugins/withProfileable.js), so production builds skip every trace section
  // and timing log below.
  private val profiling =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && context.applicationInfo.isProfileableByShell

  // Async sections need a cookie that tells two mounted views apart.
  private val traceCookie = System.identityHashCode(this)
  private val captureCookies = AtomicInteger()

  // Set at bind and cleared by the first preview frame, which arrives on
  // CameraX's camera thread rather than the main thread.
  private val awaitingFirstFrame = AtomicBoolean(false)

  // Read and written only on CameraX's camera thread.
  private var lastFrameNs = 0L

  /**
   * Called once per completed preview frame. It closes the bind-to-first-frame
   * section and then records each frame interval as a Perfetto counter. The
   * per-frame logcat line is only written with diagnostics on, because logging
   * at the preview rate would itself show up in the benchmark.
   */
  private val frameCallback = object : CameraCaptureSession.CaptureCallback() {
    override fun onCaptureCompleted(
      session: CameraCaptureSession,
      request: CaptureRequest,
      result: TotalCaptureResult
    ) {
      val now = System.nanoTime()
      if (awaitingFirstFrame.compareAndSet(true, false)) {
        Trace.endAsyncSection(SECTION_FIRST_FRAME, traceCookie)
        Log.i(PERF_TAG, "first_preview_frame since_process_start_ms=${msSinceProcessStart()}")
        lastFrameNs = now
        return
      }
      val intervalUs = (now - lastFrameNs) / 1_000
      lastFrameNs = now
      Trace.setCounter(COUNTER_FRAME_INTERVAL, intervalUs.toInt())
      if (diagnostics) Log.d(PERF_TAG, "frame_interval_us=$intervalUs")
    }
  }

  /** Closes the first-frame section when the session ends before a frame. */
  private fun abandonFirstFrameSection() {
    if (awaitingFirstFrame.compareAndSet(true, false)) {
      Trace.endAsyncSection(SECTION_FIRST_FRAME, traceCookie)
    }
  }

  private fun beginSection(name: String, cookie: Int) {
    if (profiling) Trace.beginAsyncSection(name, cookie)
  }

  private fun endSection(name: String, cookie: Int) {
    if (profiling) Trace.endAsyncSection(name, cookie)
  }

  private inline fun <T> traced(name: String, block: () -> T): T =
    if (profiling) trace(name, block) else block()

  private fun perfLog(message: String) {
    if (profiling) Log.i(PERF_TAG, message)
  }

  private fun diagnostic(event: String, fields: Map<String, Any> = emptyMap()) {
    if (!diagnostics) return
    onCameraDiagnostic(mapOf("event" to event) + fields)
  }

  init {
    addView(previewView)
    addView(zoomLabel)

    beginSection(SECTION_PROVIDER, traceCookie)
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      endSection(SECTION_PROVIDER, traceCookie)
      try {
        cameraProvider = future.get()
        // The provider arrives on its own schedule, so it may land before or
        // after the first prop batch. Raise the pending rebind and go through
        // applyPendingConfiguration rather than binding here: binding directly
        // was a second path to the first session, and a cold mount bound twice
        // -- bind 1 lived 3 ms before the prop path tore it down and bound
        // again.
        needsRebind = true
        applyPendingConfiguration()
      } catch (error: Throwable) {
        onCameraError(mapOf("message" to (error.message ?: error.toString())))
      }
    }, ContextCompat.getMainExecutor(context))
  }

  /**
   * React Native does not run Android's measure pass over children added with
   * addView, and it swallows the requestLayout that PreviewView raises when its
   * own surface child appears (React Native issue #17968). Both halves of that
   * have to be answered or the preview stays blank:
   *
   * - this flag makes expo-modules-core re-measure and re-lay-out the subtree
   *   after a requestLayout, inside the bounds Yoga gave this view;
   * - onLayout below measures the child before laying it out, so PreviewView's
   *   own SurfaceView gets a size on the very first pass.
   *
   * The blank preview on 2026-09-28 was a React Native layout fault, not this:
   * the view itself arrived 0 dp high. These two lines are still required,
   * because a child that is laid out but never measured has no size of its own
   * to give its SurfaceView.
   */
  override val shouldUseAndroidLayout: Boolean = true

  /**
   * Pinch to zoom. The detector has to be fed from this view, and this view has
   * to claim the gesture, because of how react-native-gesture-handler delivers
   * touches to a native view.
   *
   * Gesture.Native() drives RNGH's NativeViewGestureHandler, which sends events
   * with `view.onTouchEvent` and only once it has activated. It activates when
   * `onInterceptTouchEvent` returns true, or when the view reports isPressed.
   * ExpoView is a LinearLayout, so both were false: the handler stayed in BEGAN
   * and forwarded nothing. The detector used to sit on an OnTouchListener on
   * the child PreviewView, which that path cannot reach twice over, because
   * `onTouchEvent` neither descends to children nor invokes an OnTouchListener.
   * A pinch never reached the detector at all.
   *
   * Claiming from the first event gives the detector the whole stream.
   * Gesture.Simultaneous keeps the JavaScript tap-to-focus recognizer alive
   * beside it.
   */
  override fun onInterceptTouchEvent(event: MotionEvent): Boolean = pinchZoom

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!pinchZoom) return false
    scaleGestureDetector.onTouchEvent(event)
    return true
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int
  ) {
    val width = right - left
    val height = bottom - top
    previewView.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    previewView.layout(0, 0, width, height)

    // The label sits at the left edge and mid-height, clear of the top bar and
    // the shutter row that React Native draws above this view.
    zoomLabel.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.AT_MOST),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.AT_MOST)
    )
    val labelLeft = (ZOOM_LABEL_MARGIN_DP * resources.displayMetrics.density).toInt()
    val labelTop = (height - zoomLabel.measuredHeight) / 2
    zoomLabel.layout(
      labelLeft,
      labelTop,
      labelLeft + zoomLabel.measuredWidth,
      labelTop + zoomLabel.measuredHeight
    )
  }

  /**
   * Applies whatever the last prop batch changed, as one session operation.
   * Called from the module's OnViewDidUpdateProps and from the camera-provider
   * listener, which is why the rebind is scheduled at most once: both callers
   * can arrive in either order, and each one alone must still bind.
   */
  fun applyPendingConfiguration() {
    if (!needsRebind) return
    needsRebind = false
    if (!isActive) {
      unbindCamera()
      return
    }
    if (rebindScheduled) return
    rebindScheduled = true
    post {
      rebindScheduled = false
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

  @OptIn(ExperimentalCamera2Interop::class)
  private fun bindCamera() = traced(SECTION_BIND) {
    val provider = cameraProvider ?: return@traced
    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner ?: run {
      onCameraError(mapOf("message" to "Camera activity is not a LifecycleOwner"))
      return@traced
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

      val preview = Preview.Builder()
        .also {
          if (profiling) Camera2Interop.Extender(it).setSessionCaptureCallback(frameCallback)
        }
        .build()
        .also { it.surfaceProvider = previewView.surfaceProvider }
      val imageCapture = buildImageCapture(activeTuning)
      val sessionConfig = buildSessionConfig(
        provider,
        selector,
        preview,
        imageCapture,
        activeTuning
      )

      // Raised before the bind, so a frame that lands as soon as the session
      // starts still closes the section.
      awaitingFirstFrame.set(profiling)
      beginSection(SECTION_FIRST_FRAME, traceCookie)
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
      abandonFirstFrameSection()
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

  private fun unbindCamera() = traced(SECTION_UNBIND) {
    val provider = cameraProvider ?: return@traced
    abandonFirstFrameSection()
    val wasBound = boundSessionConfig != null
    boundSessionConfig?.let { provider.unbind(it) }
    boundSessionConfig = null
    imageCaptureUseCase = null
    camera = null
    // CameraX zoom resets when the camera closes; the view zoom does the same,
    // so a new session never starts zoomed.
    resetViewZoom()
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
    // The section starts here, before the main-thread hop, so the trace shows
    // the whole wait from the JavaScript call to the saved file.
    val captureCookie = captureCookies.incrementAndGet()
    val calledAtNs = System.nanoTime()
    beginSection(SECTION_CAPTURE, captureCookie)

    // CameraX use cases are bound on the main thread, so the capture request
    // joins them there instead of touching them from the caller's thread.
    post {
      val imageCapture = imageCaptureUseCase ?: run {
        endSection(SECTION_CAPTURE, captureCookie)
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
            traced(SECTION_RESOLVE) {
              resolveWithFileDimensions(outputFile, promise, requestedAt)
            }
            endSection(SECTION_CAPTURE, captureCookie)
            perfLog(
              "capture_saved call_to_saved_ms=${(System.nanoTime() - calledAtNs) / 1_000_000}" +
                " since_process_start_ms=${msSinceProcessStart()}"
            )
          }

          override fun onError(exception: ImageCaptureException) {
            endSection(SECTION_CAPTURE, captureCookie)
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

  /**
   * A tap, in fractions of the view. Undoes the view zoom, so a zoomed preview
   * focuses what is under the finger and not the point that was there at 1x.
   */
  fun focus(normalizedX: Double, normalizedY: Double): Boolean {
    val zoom = viewZoom
    return focusPreviewPoint(
      zoom.previewFraction(normalizedX.toFloat()).toDouble(),
      zoom.previewFraction(normalizedY.toFloat()).toDouble(),
      normalizedX,
      normalizedY
    )
  }

  /**
   * A point already in the preview, which a view zoom does not move. The
   * requested point is what the caller asked for, and is what is checked and
   * reported; for a tap it differs from the preview point while zoomed.
   */
  private fun focusPreviewPoint(
    previewX: Double,
    previewY: Double,
    requestedX: Double = previewX,
    requestedY: Double = previewY
  ): Boolean {
    // Reported whether or not it is applied: a tap that arrives but is refused
    // looks identical on screen to a tap that never arrived.
    fun report(accepted: Boolean, reason: String) {
      diagnostic(
        "focus_requested",
        mapOf(
          "accepted" to accepted,
          "reason" to reason,
          "normalized_x" to requestedX,
          "normalized_y" to requestedY,
          "subject_metering" to subjectMetering,
          "camera_position" to position
        )
      )
    }

    if (requestedX !in 0.0..1.0 || requestedY !in 0.0..1.0) {
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
      (previewX.coerceIn(0.0, 1.0) * previewView.width).toFloat(),
      (previewY.coerceIn(0.0, 1.0) * previewView.height).toFloat()
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
    return focusPreviewPoint(
      region.x + region.width / 2.0,
      region.y + region.height / 2.0
    )
  }

  override fun onDetachedFromWindow() {
    unbindCamera()
    super.onDetachedFromWindow()
  }
}

private const val ZOOM_LABEL_MARGIN_DP = 16
private const val ZOOM_LABEL_PADDING_DP = 6
private const val ZOOM_LABEL_RADIUS_DP = 16
private const val ZOOM_LABEL_TEXT_SP = 14f
private const val ZOOM_LABEL_BACKGROUND = 0x99000000.toInt()
