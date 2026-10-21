package expo.modules.nativeidentificationcamera

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.RectF
import android.media.ExifInterface
import android.util.Range
import android.util.Size
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.SessionConfig
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.camera.view.TransformExperimental
import androidx.camera.view.transform.CoordinateTransform
import androidx.camera.view.transform.ImageProxyTransformFactory
import androidx.camera.view.transform.OutputTransform
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

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
 *
 * The live detector (the `liveDetector` prop) does not trip this gate: it reads
 * CameraX ImageAnalysis frames in RGBA at about VGA, not a RAW artifact.
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

  /** Throttled live-detector results for JS. See NativeDetectionsEvent. */
  val onDetections by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }

  private val detectionOverlay = DetectionOverlayView(context).apply {
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
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
   * Pinch to zoom. Off by default, so the view claims no touch of its own and
   * the whole gesture stays with the JavaScript tap-to-focus recognizer.
   */
  var pinchZoom: Boolean = false

  /**
   * Driven by the `camera_performance_checks` setting. Off by default, so a
   * normal install reports nothing from here.
   */
  // Read on the analysis thread as well as the main thread.
  @Volatile
  var diagnostics: Boolean = false

  /**
   * Live detector. Adding or removing the ImageAnalysis use case changes the
   * session's stream set, so a change costs one rebind, like the tuning props.
   */
  var liveDetector: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      needsRebind = true
    }

  // ── Live detector state ────────────────────────────────────────────────────
  //
  // Threads: the analyzer, the LiveDetector and its stats run on
  // analysisExecutor only. Box delivery, the overlay and every event run on the
  // main thread. `detectorGeneration` is the hand-off guard: it changes on
  // every bind and unbind, and a result from an older generation is dropped, so
  // boxes from a torn-down session never reach the overlay.

  private var analysisExecutor: ExecutorService? = null

  // Written on the main thread, read once by openDetector on the analysis
  // thread for the detector_ready sizes.
  @Volatile
  private var analysisUseCase: ImageAnalysis? = null

  @Volatile
  private var previewUseCase: Preview? = null

  @Volatile
  private var detectorGeneration = 0

  // Analysis thread only.
  private var detector: LiveDetector? = null
  private var detectorUnavailable = false
  private var frameBitmap: Bitmap? = null
  private val detectorStats = DetectorStats()

  // Main thread only.
  private var lastDetectionsEventAt = 0L
  private var lastEventHadDetections = false

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
    addView(detectionOverlay)

    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
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
    detectionOverlay.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    )
    detectionOverlay.layout(0, 0, width, height)
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
    analysis: ImageAnalysis?,
    tuning: CaptureTuning
  ): SessionConfig {
    val builder = if (analysis == null) {
      SessionConfig.Builder(preview, imageCapture)
    } else {
      SessionConfig.Builder(preview, imageCapture, analysis)
    }
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
      val analysis = if (liveDetector) buildImageAnalysis() else null
      // Building the config already queries the device (the frame-rate probe),
      // so a throw here means "unsupported", not "no camera".
      val withAnalysis = analysis?.let {
        try {
          buildSessionConfig(provider, selector, preview, imageCapture, it, activeTuning)
        } catch (error: Throwable) {
          diagnostic(
            "detector_bind_failed",
            mapOf("message" to (error.message ?: error.toString()), "camera_position" to position)
          )
          null
        }
      }

      // The detector is optional and the capture is not: if this device cannot
      // run the analysis stream beside preview and capture, bind without it
      // and say so, rather than lose the camera.
      var boundCamera: Camera? = null
      var sessionConfig: SessionConfig? = null
      if (withAnalysis != null) {
        val supported = try {
          provider.getCameraInfo(selector).isSessionConfigSupported(withAnalysis)
        } catch (error: Throwable) {
          false
        }
        if (supported) {
          try {
            boundCamera = provider.bindToLifecycle(lifecycleOwner, selector, withAnalysis)
            sessionConfig = withAnalysis
          } catch (error: Throwable) {
            runCatching { provider.unbind(withAnalysis) }
            diagnostic(
              "detector_bind_failed",
              mapOf("message" to (error.message ?: error.toString()), "camera_position" to position)
            )
          }
        } else {
          diagnostic("detector_unsupported_combination", mapOf("camera_position" to position))
        }
      }
      if (boundCamera == null || sessionConfig == null) {
        sessionConfig = buildSessionConfig(provider, selector, preview, imageCapture, null, activeTuning)
        boundCamera = provider.bindToLifecycle(lifecycleOwner, selector, sessionConfig)
      }
      val analysisBound = sessionConfig === withAnalysis

      boundSessionConfig = sessionConfig
      imageCaptureUseCase = imageCapture
      previewUseCase = preview
      camera = boundCamera
      detectorGeneration += 1
      if (analysisBound && analysis != null) {
        analysisUseCase = analysis
        startAnalysis(analysis, detectorGeneration)
      }
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
          "live_detector" to liveDetector,
          "analysis_bound" to analysisBound,
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

  // ── Live detector ──────────────────────────────────────────────────────────

  /**
   * 4:3 at about VGA: the detector's input is 640 px square, so a larger
   * frame only costs conversion time. 4:3 is also Preview's default aspect,
   * and the coordinate transform below assumes the two streams frame the same
   * field (it logs "source viewport does not match" when they do not). The
   * `detector_ready` diagnostic reports both sizes so a drive can check it.
   */
  private fun buildImageAnalysis(): ImageAnalysis =
    ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
      .setResolutionSelector(
        ResolutionSelector.Builder()
          .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
          .setResolutionStrategy(
            ResolutionStrategy(
              Size(640, 480),
              ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
            )
          )
          .build()
      )
      .build()

  private fun startAnalysis(analysis: ImageAnalysis, generation: Int) {
    val executor = analysisExecutor ?: Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, "FeralSpotterDetector")
    }.also { analysisExecutor = it }
    analysis.setAnalyzer(executor) { image -> analyzeFrame(image, generation) }
  }

  /**
   * Main thread. Detaches the analyzer and clears the overlay. The model stays
   * loaded while the detector is still wanted, so a flip or a tuning change
   * does not pay the load and GPU compile again.
   */
  private fun stopAnalysis() {
    analysisUseCase?.clearAnalyzer()
    analysisUseCase = null
    detectorGeneration += 1
    clearDetections()
    if (!liveDetector) releaseDetector()
  }

  /**
   * Main thread. Clears the overlay, and tells JS once if it last saw boxes,
   * so a JS consumer never keeps a box from a session that has ended.
   */
  private fun clearDetections() {
    detectionOverlay.clear()
    if (lastEventHadDetections) {
      onDetections(mapOf("detections" to emptyList<Any>(), "inferenceMs" to 0.0))
    }
    lastEventHadDetections = false
    lastDetectionsEventAt = 0L
  }

  private fun releaseDetector() {
    val executor = analysisExecutor ?: return
    executor.execute {
      detector?.close()
      detector = null
      detectorUnavailable = false
      frameBitmap?.recycle()
      frameBitmap = null
      detectorStats.reset()
    }
  }

  /** Called from the module's OnViewDestroys. The view is not reused after it. */
  fun release() {
    liveDetector = false
    unbindCamera()
    releaseDetector()
    analysisExecutor?.shutdown()
    analysisExecutor = null
  }

  /** Analysis thread. Always closes [image]. */
  @OptIn(TransformExperimental::class)
  private fun analyzeFrame(image: ImageProxy, generation: Int) {
    try {
      if (generation != detectorGeneration || detectorUnavailable) return
      val active = detector ?: openDetector() ?: return

      val bitmap = frameBitmapOf(image)
      val result = active.detect(bitmap, image.imageInfo.rotationDegrees)

      // Source space: the upright, uncropped analysis frame, which is the space
      // the detections are normalized to. Must be read before image.close().
      val source = ImageProxyTransformFactory().apply {
        isUsingRotationDegrees = true
        isUsingCropRect = false
      }.getOutputTransform(image)

      detectorStats.record(result)
      if (detectorStats.isWindowFull()) {
        // Drain every window, reported or not: the window is a fixed array.
        val fields = detectorStats.drain(active)
        if (diagnostics) post { diagnostic("detector_stats", fields) }
      }
      post { deliverDetections(result, source, generation, active.sidecar.labels) }
    } catch (error: Throwable) {
      // One report, then the detector stays off for this view: a per-frame
      // failure would flood both the log and the event stream.
      detectorUnavailable = true
      val message = error.message ?: error.toString()
      post {
        clearDetections()
        diagnostic("detector_unavailable", mapOf("reason" to "inference_failed", "message" to message))
      }
    } finally {
      image.close()
    }
  }

  /** Analysis thread. Null means the detector is unavailable and was reported. */
  private fun openDetector(): LiveDetector? {
    val previewSize = previewUseCase?.resolutionInfo?.resolution
    val analysisSize = analysisUseCase?.resolutionInfo?.resolution
    return when (val opened = LiveDetector.open(context.assets)) {
      is LiveDetector.Opened.Ready -> {
        val ready = opened.detector
        detector = ready
        val fields = mutableMapOf<String, Any>(
          "model_source" to ready.sidecar.source,
          "accelerator" to ready.accelerator,
          "load_ms" to ready.loadMs,
          "input_size" to ready.sidecar.imgsz,
          "end_to_end" to ready.sidecar.endToEnd,
          "class_count" to ready.sidecar.labels.size,
          "target_count" to ready.sidecar.targetClasses.size,
          "score_threshold" to ready.sidecar.scoreThreshold.toDouble(),
          "preview_size" to (previewSize?.let { "${it.width}x${it.height}" } ?: "unknown"),
          "analysis_size" to (analysisSize?.let { "${it.width}x${it.height}" } ?: "unknown"),
          "aspect_match" to sameAspect(previewSize, analysisSize)
        )
        ready.gpuFailure?.let { fields["gpu_failure"] = it }
        post { diagnostic("detector_ready", fields) }
        ready
      }
      LiveDetector.Opened.Missing -> {
        detectorUnavailable = true
        post { diagnostic("detector_unavailable", mapOf("reason" to "model_missing")) }
        null
      }
      is LiveDetector.Opened.Failed -> {
        detectorUnavailable = true
        val message = opened.message
        post {
          diagnostic("detector_unavailable", mapOf("reason" to "load_failed", "message" to message))
        }
        null
      }
    }
  }

  private fun sameAspect(a: Size?, b: Size?): Boolean {
    if (a == null || b == null) return false
    return Math.abs(a.width.toDouble() / a.height - b.width.toDouble() / b.height) < 0.01
  }

  /**
   * Analysis thread. RGBA frames whose rows carry no padding are copied into a
   * reused bitmap; anything else goes through ImageProxy.toBitmap(), which
   * allocates per frame but handles every stride.
   */
  private fun frameBitmapOf(image: ImageProxy): Bitmap {
    val plane = image.planes[0]
    if (plane.pixelStride != 4 || plane.rowStride != image.width * 4) return image.toBitmap()
    val reusable = frameBitmap?.takeIf { it.width == image.width && it.height == image.height }
      ?: Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888).also {
        frameBitmap?.recycle()
        frameBitmap = it
      }
    val buffer = plane.buffer
    buffer.rewind()
    reusable.copyPixelsFromBuffer(buffer)
    return reusable
  }

  /** Main thread. Maps upright-frame boxes into this view and shows them. */
  @OptIn(TransformExperimental::class)
  private fun deliverDetections(
    result: LiveDetector.Result,
    source: OutputTransform,
    generation: Int,
    labels: List<String>
  ) {
    if (generation != detectorGeneration) return
    val target = previewView.outputTransform ?: return
    val viewWidth = previewView.width.toFloat()
    val viewHeight = previewView.height.toFloat()
    if (viewWidth <= 0f || viewHeight <= 0f) return

    val transform = CoordinateTransform(source, target)
    val boxes = ArrayList<DetectionOverlayView.Box>(result.detections.size)
    val payload = ArrayList<Map<String, Any>>(result.detections.size)
    for (detection in result.detections) {
      val rect = RectF(
        detection.left * result.uprightWidth,
        detection.top * result.uprightHeight,
        detection.right * result.uprightWidth,
        detection.bottom * result.uprightHeight
      )
      transform.mapRect(rect)
      val normalized = RectF(
        (rect.left / viewWidth).coerceIn(0f, 1f),
        (rect.top / viewHeight).coerceIn(0f, 1f),
        (rect.right / viewWidth).coerceIn(0f, 1f),
        (rect.bottom / viewHeight).coerceIn(0f, 1f)
      )
      // A box wholly outside the visible crop collapses to a line; skip it.
      if (normalized.width() <= 0f || normalized.height() <= 0f) continue
      val label = labels.getOrElse(detection.classIndex) { "class ${detection.classIndex}" }
      boxes.add(
        DetectionOverlayView.Box(normalized, "$label ${(detection.score * 100).toInt()}%")
      )
      payload.add(
        mapOf(
          "x" to normalized.left.toDouble(),
          "y" to normalized.top.toDouble(),
          "width" to normalized.width().toDouble(),
          "height" to normalized.height().toDouble(),
          "score" to detection.score.toDouble(),
          "label" to label
        )
      )
    }
    detectionOverlay.show(boxes)
    emitDetections(payload, result.inferenceMs)
  }

  /**
   * At most one event per [DETECTIONS_EVENT_INTERVAL_MS], plus one event when
   * the boxes clear, so a JS consumer never keeps a stale box.
   */
  private fun emitDetections(payload: List<Map<String, Any>>, inferenceMs: Double) {
    val now = System.currentTimeMillis()
    val hasDetections = payload.isNotEmpty()
    val cleared = !hasDetections && lastEventHadDetections
    if (!cleared && now - lastDetectionsEventAt < DETECTIONS_EVENT_INTERVAL_MS) return
    if (!hasDetections && !lastEventHadDetections && lastDetectionsEventAt != 0L) return
    lastDetectionsEventAt = now
    lastEventHadDetections = hasDetections
    onDetections(mapOf("detections" to payload, "inferenceMs" to inferenceMs))
  }

  private fun unbindCamera() {
    // Before the provider check: a toggle-off while the provider is still
    // loading must still release the model.
    stopAnalysis()
    val provider = cameraProvider ?: return
    val wasBound = boundSessionConfig != null
    boundSessionConfig?.let { provider.unbind(it) }
    boundSessionConfig = null
    imageCaptureUseCase = null
    previewUseCase = null
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

  private companion object {
    const val DETECTIONS_EVENT_INTERVAL_MS = 200L
  }
}
