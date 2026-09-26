package expo.modules.nativeidentificationcamera

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import android.net.Uri
import android.util.Range
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2CameraControl
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.CaptureRequestOptions
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalZeroShutterLag
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
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

@SuppressLint("ViewConstructor")
class NativeIdentificationCameraView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  val onCameraReady by EventDispatcher()
  val onCameraError by EventDispatcher()

  private val previewView = PreviewView(context).apply {
    layoutParams = LayoutParams(
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
        val clamped = requested.coerceIn(
          zoomState.minZoomRatio,
          zoomState.maxZoomRatio
        )
        boundCamera.cameraControl.setZoomRatio(clamped)
        return true
      }
    }
  )

  private var cameraProvider: ProcessCameraProvider? = null
  private var previewUseCase: Preview? = null
  private var imageCaptureUseCase: ImageCapture? = null
  private var camera: Camera? = null

  var isActive: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      if (value) bindCamera() else unbindCamera()
    }

  var position: String = "back"
    set(value) {
      val normalized = if (value == "front") "front" else "back"
      if (field == normalized) return
      field = normalized
      rebindCamera()
    }

  var maxDetail: Boolean = true
    set(value) {
      if (field == value) return
      field = value
      rebindCamera()
    }

  var motionPriority: Boolean = true
    set(value) {
      if (field == value) return
      field = value
      rebindCamera()
    }

  var disableLowLightBoost: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      camera?.let(::applyCamera2Policy)
    }

  var subjectMetering: Boolean = false

  init {
    addView(previewView)
    previewView.setOnTouchListener { _, event ->
      scaleGestureDetector.onTouchEvent(event)
      event.actionMasked != MotionEvent.ACTION_UP
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

  private fun rebindCamera() {
    if (!isActive) return
    post {
      unbindCamera()
      bindCamera()
    }
  }

  @OptIn(ExperimentalZeroShutterLag::class)
  private fun buildImageCapture(): ImageCapture {
    val builder = ImageCapture.Builder()

    if (maxDetail) {
      val selector = ResolutionSelector.Builder()
        .setAllowedResolutionMode(
          ResolutionSelector.PREFER_HIGHER_RESOLUTION_OVER_CAPTURE_RATE
        )
        .setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)
        .build()
      builder.setResolutionSelector(selector)
    }

    builder.setCaptureMode(
      if (motionPriority) {
        ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG
      } else if (maxDetail) {
        ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY
      } else {
        ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
      }
    )

    return builder.build()
  }

  private fun bindCamera() {
    val provider = cameraProvider ?: return
    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner ?: run {
      onCameraError(mapOf("message" to "Camera activity is not a LifecycleOwner"))
      return
    }

    try {
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
      val imageCapture = buildImageCapture()

      val boundCamera = provider.bindToLifecycle(
        lifecycleOwner,
        selector,
        preview,
        imageCapture
      )

      previewUseCase = preview
      imageCaptureUseCase = imageCapture
      camera = boundCamera
      applyCamera2Policy(boundCamera)
      onCameraReady(emptyMap<String, Any>())
    } catch (error: Throwable) {
      onCameraError(mapOf("message" to (error.message ?: error.toString())))
    }
  }

  private fun unbindCamera() {
    val provider = cameraProvider ?: return
    val useCases = listOfNotNull(previewUseCase, imageCaptureUseCase)
    if (useCases.isNotEmpty()) {
      provider.unbind(*useCases.toTypedArray())
    }
    previewUseCase = null
    imageCaptureUseCase = null
    camera = null
  }

  @OptIn(ExperimentalCamera2Interop::class)
  private fun applyCamera2Policy(boundCamera: Camera) {
    val camera2Info = Camera2CameraInfo.from(boundCamera.cameraInfo)
    val requestBuilder = CaptureRequestOptions.Builder()

    if (disableLowLightBoost) {
      requestBuilder.setCaptureRequestOption(
        CaptureRequest.CONTROL_AE_MODE,
        CaptureRequest.CONTROL_AE_MODE_ON
      )
    }

    if (motionPriority) {
      val ranges = camera2Info.getCameraCharacteristic(
        CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES
      )
      val fastestStableRange = ranges?.maxWithOrNull(
        compareBy<Range<Int>> { it.lower }.thenBy { it.upper }
      )
      if (fastestStableRange != null) {
        requestBuilder.setCaptureRequestOption(
          CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
          fastestStableRange
        )
      }
    }

    Camera2CameraControl.from(boundCamera.cameraControl)
      .setCaptureRequestOptions(requestBuilder.build())
  }

  fun capture(options: NativeCaptureOptions, promise: Promise) {
    val imageCapture = imageCaptureUseCase ?: run {
      promise.reject("ERR_CAMERA_NOT_READY", "Camera is not ready", null)
      return
    }

    imageCapture.flashMode = when (options.flashMode) {
      "on" -> ImageCapture.FLASH_MODE_ON
      "auto" -> ImageCapture.FLASH_MODE_AUTO
      else -> ImageCapture.FLASH_MODE_OFF
    }

    val outputFile = File(context.cacheDir, "${UUID.randomUUID()}.jpg")
    val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
    val resolution = imageCapture.resolutionInfo?.resolution

    imageCapture.takePicture(
      outputOptions,
      ContextCompat.getMainExecutor(context),
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
          promise.resolve(
            mapOf(
              "uri" to Uri.fromFile(outputFile).toString(),
              "width" to (resolution?.width ?: 0),
              "height" to (resolution?.height ?: 0)
            )
          )
        }

        override fun onError(exception: ImageCaptureException) {
          promise.reject("ERR_CAPTURE_FAILED", exception.message, exception)
        }
      }
    )
  }

  fun focus(normalizedX: Double, normalizedY: Double): Boolean {
    if (normalizedX !in 0.0..1.0 || normalizedY !in 0.0..1.0) return false
    val boundCamera = camera ?: return false
    if (previewView.width <= 0 || previewView.height <= 0) return false

    val point = previewView.meteringPointFactory.createPoint(
      (normalizedX * previewView.width).toFloat(),
      (normalizedY * previewView.height).toFloat()
    )
    val action = FocusMeteringAction.Builder(
      point,
      FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
    ).build()
    boundCamera.cameraControl.startFocusAndMetering(action)
    return true
  }

  fun setSubjectRegion(region: NativeSubjectRegion?): Boolean {
    if (!subjectMetering || region == null) return false
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
