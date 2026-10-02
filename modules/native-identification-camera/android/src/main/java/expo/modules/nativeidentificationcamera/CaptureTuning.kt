package expo.modules.nativeidentificationcamera

import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalZeroShutterLag
import androidx.camera.core.ImageCapture

/**
 * How the two tuning priorities map to a CameraX capture mode.
 *
 * The mapping lives here, in one table, rather than inside the view's builder,
 * so the resolved mode can be named, reported in telemetry, and changed without
 * touching session code.
 *
 * Every combination is reachable. Note that both priorities default to true, so
 * a default install always resolves to ZERO_SHUTTER_LAG and never exercises
 * MAXIMIZE_QUALITY.
 *
 * OPEN DECISION — what (maxDetail = true, motionPriority = true) should mean.
 * The pair currently resolves to ZERO_SHUTTER_LAG, which is the behaviour the
 * Android path already shipped, and iOS resolves the same pair to `.balanced`,
 * which is neither priority. The two platforms therefore disagree. Resolving
 * that is a product decision and needs the on-device Android profiling run that
 * this branch exists to enable: the resolved mode is reported in telemetry so a
 * profiling session can tell which mode actually ran. Do not change the mapping
 * to make the platforms look symmetric before that data exists.
 */
enum class CaptureTuning(
  val maxDetail: Boolean,
  val motionPriority: Boolean,
  /** Reported in telemetry, so a profiling run can name the mode that ran. */
  val telemetryName: String
) {
  /**
   * Both priorities asked for. Resolves to zero-shutter-lag today; see the
   * open decision above.
   */
  DETAIL_AND_MOTION(maxDetail = true, motionPriority = true, telemetryName = "detail_and_motion"),

  /** Detail only: the one combination that reaches MAXIMIZE_QUALITY. */
  DETAIL_ONLY(maxDetail = true, motionPriority = false, telemetryName = "detail_only"),

  /** Motion only. */
  MOTION_ONLY(maxDetail = false, motionPriority = true, telemetryName = "motion_only"),

  /** Neither priority: the lowest-latency capture CameraX offers. */
  NEITHER(maxDetail = false, motionPriority = false, telemetryName = "neither");

  /**
   * ZERO_SHUTTER_LAG keeps a ring buffer of recent frames and returns the one
   * closest to the shutter press, which is what "motion priority" is asking
   * for. MAXIMIZE_QUALITY spends more time per frame on processing.
   * MINIMIZE_LATENCY is CameraX's default and is neither.
   */
  @OptIn(ExperimentalZeroShutterLag::class)
  fun captureMode(): Int = when (this) {
    DETAIL_AND_MOTION -> ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG
    MOTION_ONLY -> ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG
    DETAIL_ONLY -> ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY
    NEITHER -> ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
  }

  /**
   * Whether to ask for the highest available resolution even when that costs
   * capture rate. Only the detail priority wants this.
   */
  fun prefersHighestResolution(): Boolean = maxDetail

  /**
   * Whether to pin a frame rate range on the session. Only the motion priority
   * wants this; it costs a supported-range query at bind time.
   */
  fun prefersFrameRateRange(): Boolean = motionPriority

  companion object {
    fun of(maxDetail: Boolean, motionPriority: Boolean): CaptureTuning =
      entries.first { it.maxDetail == maxDetail && it.motionPriority == motionPriority }
  }
}
