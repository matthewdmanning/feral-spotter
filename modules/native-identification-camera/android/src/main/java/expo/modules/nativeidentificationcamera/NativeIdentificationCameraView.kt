package expo.modules.nativeidentificationcamera

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.TotalCaptureResult
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.media.ExifInterface
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.util.Log
import android.util.Range
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
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
  // The scale is kept in `viewZoom` and the pan in previewView.translationX/Y;
  // both are about the view's centre.
  @Volatile
  private var viewZoom = 1f
  private var lastFocusX = 0f
  private var lastFocusY = 0f

  private val scaleGestureDetector = ScaleGestureDetector(
    context,
    object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
      override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
        lastFocusX = detector.focusX
        lastFocusY = detector.focusY
        return true
      }

      // Keeps the point of the preview under the fingers under the fingers, so
      // a two-finger move pans while it scales.
      override fun onScale(detector: ScaleGestureDetector): Boolean {
        val oldZoom = viewZoom
        val newZoom = (oldZoom * detector.scaleFactor).coerceIn(1f, MAX_VIEW_ZOOM)
        val centreX = previewView.width / 2f
        val centreY = previewView.height / 2f
        val translateX = detector.focusX - centreX -
          (lastFocusX - centreX - previewView.translationX) * newZoom / oldZoom
        val translateY = detector.focusY - centreY -
          (lastFocusY - centreY - previewView.translationY) * newZoom / oldZoom
        lastFocusX = detector.focusX
        lastFocusY = detector.focusY
        applyViewTransform(newZoom, translateX, translateY)
        return true
      }

      // One event per pinch, not one per frame of it. A run that shows both
      // pinch_ended and focus_requested is the evidence that the touch listener
      // lets tap and pinch coexist.
      override fun onScaleEnd(detector: ScaleGestureDetector) {
        diagnostic(
          "pinch_ended",
          mapOf(
            "view_zoom" to viewZoom.toDouble(),
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

  // One finger drags the zoomed preview. Two fingers are the scale detector's.
  private val panGestureDetector = GestureDetector(
    context,
    object : GestureDetector.SimpleOnGestureListener() {
      override fun onScroll(
        e1: MotionEvent?,
        e2: MotionEvent,
        distanceX: Float,
        distanceY: Float
      ): Boolean {
        if (viewZoom <= 1f || scaleGestureDetector.isInProgress) return false
        applyViewTransform(
          viewZoom,
          previewView.translationX - distanceX,
          previewView.translationY - distanceY
        )
        return true
      }
    }
  )

  // Small copy of the whole preview with a box for the part on screen, so a
  // zoomed-in user can still see where they are in the field.
  private val zoomMap = ZoomMapView(context).apply {
    visibility = View.GONE
  }
  private var zoomMapRefreshing = false
  private val refreshZoomMap = object : Runnable {
    override fun run() {
      if (!zoomMapRefreshing) return
      val width = zoomMap.width
      val height = zoomMap.height
      // PreviewView.getBitmap is the displayed frame, already turned upright.
      // It is full view size, so the refresh is slow and stops at 1x.
      val frame = if (width > 0 && height > 0) previewView.bitmap else null
      if (frame != null) {
        val small = Bitmap.createScaledBitmap(frame, width, height, true)
        if (small !== frame) frame.recycle()
        zoomMap.showFrame(small)
      }
      postDelayed(this, ZOOM_MAP_REFRESH_MS)
    }
  }

  private fun applyViewTransform(zoom: Float, translateX: Float, translateY: Float) {
    val clamped = zoom.coerceIn(1f, MAX_VIEW_ZOOM)
    // Edges are kept on screen: no black border beside a zoomed preview.
    val maxX = (clamped - 1f) * previewView.width / 2f
    val maxY = (clamped - 1f) * previewView.height / 2f
    viewZoom = clamped
    previewView.scaleX = clamped
    previewView.scaleY = clamped
    previewView.translationX = translateX.coerceIn(-maxX, maxX)
    previewView.translationY = translateY.coerceIn(-maxY, maxY)
    updateZoomMap()
  }

  private fun resetViewZoom() = applyViewTransform(1f, 0f, 0f)

  private fun updateZoomMap() {
    val zoomed = pinchZoom && viewZoom > 1f
    zoomMap.visibility = if (zoomed) View.VISIBLE else View.GONE
    if (!zoomed) {
      zoomMapRefreshing = false
      removeCallbacks(refreshZoomMap)
      return
    }
    // The part of the preview now on screen, as fractions of the whole.
    val width = previewView.width.toFloat().coerceAtLeast(1f)
    val height = previewView.height.toFloat().coerceAtLeast(1f)
    zoomMap.showViewport(
      0.5f + (-0.5f - previewView.translationX / width) / viewZoom,
      0.5f + (-0.5f - previewView.translationY / height) / viewZoom,
      0.5f + (0.5f - previewView.translationX / width) / viewZoom,
      0.5f + (0.5f - previewView.translationY / height) / viewZoom
    )
    if (!zoomMapRefreshing) {
      zoomMapRefreshing = true
      post(refreshZoomMap)
    }
  }

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

  /**
   * Pinch to zoom the preview. Off by default, so the view claims no touch of
   * its own and the whole gesture stays with the JavaScript tap-to-focus
   * recognizer. It zooms the view only; the photo stays full field. On needs a
   * TextureView, which PreviewView calls COMPATIBLE mode, because only that
   * mode allows scaling the preview freely.
   */
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
    addView(zoomMap)

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
    panGestureDetector.onTouchEvent(event)
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

    // The map keeps the preview's shape, at the left edge and mid-height, clear
    // of the top bar and the shutter row that React Native draws above this view.
    val density = resources.displayMetrics.density
    val mapWidth = (ZOOM_MAP_WIDTH_DP * density).toInt()
    val mapHeight = if (width > 0) mapWidth * height / width else mapWidth
    val mapLeft = (ZOOM_MAP_MARGIN_DP * density).toInt()
    val mapTop = (height - mapHeight) / 2
    zoomMap.measure(
      MeasureSpec.makeMeasureSpec(mapWidth, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(mapHeight, MeasureSpec.EXACTLY)
    )
    zoomMap.layout(mapLeft, mapTop, mapLeft + mapWidth, mapTop + mapHeight)

    // A new size changes how far the preview may pan.
    if (viewZoom > 1f) {
      applyViewTransform(viewZoom, previewView.translationX, previewView.translationY)
    }
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
   * @param viewSpace true for a tap, which is where the user touched the zoomed
   * view. false for a point already in the preview itself, such as a subject
   * region, which a view zoom does not move.
   */
  fun focus(normalizedX: Double, normalizedY: Double, viewSpace: Boolean = true): Boolean {
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

    val width = previewView.width.toFloat()
    val height = previewView.height.toFloat()
    var pointX = (normalizedX * width).toFloat()
    var pointY = (normalizedY * height).toFloat()
    if (viewSpace) {
      // Undo the view zoom, so a tap on a zoomed preview focuses what is under
      // the finger and not the point that was there at 1x.
      val zoom = viewZoom
      pointX = width / 2f + (pointX - width / 2f - previewView.translationX) / zoom
      pointY = height / 2f + (pointY - height / 2f - previewView.translationY) / zoom
    }
    val point = previewView.meteringPointFactory.createPoint(
      pointX.coerceIn(0f, width),
      pointY.coerceIn(0f, height)
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
      region.y + region.height / 2.0,
      viewSpace = false
    )
  }

  override fun onDetachedFromWindow() {
    zoomMapRefreshing = false
    removeCallbacks(refreshZoomMap)
    unbindCamera()
    super.onDetachedFromWindow()
  }
}

// The most the preview can be magnified. Past this the preview stream is too
// coarse to show more.
private const val MAX_VIEW_ZOOM = 5f
private const val ZOOM_MAP_REFRESH_MS = 250L
private const val ZOOM_MAP_WIDTH_DP = 96
private const val ZOOM_MAP_MARGIN_DP = 16

/** The small whole-field picture with a box around the part on screen. */
private class ZoomMapView(context: Context) : View(context) {
  private var frame: Bitmap? = null
  private val viewport = RectF(0f, 0f, 1f, 1f)
  private val destination = Rect()
  private val box = RectF()
  private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f * context.resources.displayMetrics.density
    color = Color.WHITE
  }

  init {
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  fun showFrame(bitmap: Bitmap) {
    val previous = frame
    frame = bitmap
    if (previous !== bitmap) previous?.recycle()
    invalidate()
  }

  fun showViewport(left: Float, top: Float, right: Float, bottom: Float) {
    viewport.set(left, top, right, bottom)
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    destination.set(0, 0, width, height)
    frame?.let { canvas.drawBitmap(it, null, destination, null) }
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), outline)
    box.set(
      viewport.left * width,
      viewport.top * height,
      viewport.right * width,
      viewport.bottom * height
    )
    canvas.drawRect(box, outline)
  }
}
