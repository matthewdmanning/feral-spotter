package expo.modules.nativeidentificationcamera

import android.util.Range
import androidx.camera.core.Camera
import androidx.camera.core.ImageCapture
import androidx.camera.core.SessionConfig

/**
 * Represents the complete state of one successfully bound CameraX session.
 * Construct it after bindToLifecycle succeeds; clear the view's reference when
 * unbinding so captures read one consistent session snapshot.
 */
data class BoundSession(
  val sessionConfig: SessionConfig,
  val imageCapture: ImageCapture,
  val camera: Camera,
  val tuning: CaptureTuning,
  val zslSupported: Boolean,
  /** The field capture config the use case was built from; null when tuning built it. */
  val fieldConfig: FieldCaptureConfig?,
  /** The frame-rate range requested by this session, or null for CameraX's default. */
  val frameRateRange: Range<Int>?,
  /** The logical CameraX/Camera2 id selected at bind time. */
  val cameraId: String,
  /** Whether this session's high-resolution configuration disabled requested ZSL. */
  val zslDisabledByConfig: Boolean
) {
  /**
   * Use this function when reporting the mode a bound session will run for a
   * capture flash mode. It depends on this session's tuning, field config,
   * ZSL support and high-resolution fallback state.
   */
  fun runningCaptureMode(flashMode: Int): Int = CaptureTuning.runningCaptureMode(
    fieldConfig?.captureMode ?: tuning.captureMode(),
    zslSupported,
    flashMode,
    zslDisabledByConfig
  )
}
