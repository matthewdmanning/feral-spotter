package expo.modules.nativeidentificationcamera

import android.util.Range
import androidx.camera.core.Camera
import androidx.camera.core.ImageCapture
import androidx.camera.core.SessionConfig

/**
 * One bound camera session, as a single value. bindCamera assigns it once,
 * after bindToLifecycle succeeds; unbindCamera clears it. A reader takes one
 * snapshot, so it never sees half of one session and half of the next.
 *
 * Main-thread confined: bind, unbind, capture, focus and setSubjectRegion all
 * run on the main thread (expo-modules-core runs every view-scoped
 * AsyncFunction on Queues.MAIN).
 *
 * The tuning and field config are the ones this session was built from, so a
 * capture reports the mode that runs even while a prop change waits for its
 * rebind.
 */
data class BoundSession(
  val sessionConfig: SessionConfig,
  val imageCapture: ImageCapture,
  val camera: Camera,
  val tuning: CaptureTuning,
  val zslSupported: Boolean,
  /** The field capture config the use case was built from; null when the tuning built it. */
  val fieldConfig: FieldCaptureConfig?,
  /**
   * The frame-rate range the session asked for, or null for CameraX's default.
   * It bounds the still's auto-exposure too, so each photo reports it.
   */
  val frameRateRange: Range<Int>?
) {
  /**
   * The capture mode CameraX runs at this flash mode: the field capture
   * config's mode when one built the use case, else the tuning's.
   */
  fun runningCaptureMode(flashMode: Int): Int = CaptureTuning.runningCaptureMode(
    fieldConfig?.captureMode ?: tuning.captureMode(),
    zslSupported,
    flashMode
  )
}
