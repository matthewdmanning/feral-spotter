package expo.modules.nativeidentificationcamera

import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalZeroShutterLag
import androidx.camera.core.ImageCapture

private const val LOW_LIGHT_BOOST_MAX_FPS = 30

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
   * Whether the requested ZSL mode is disabled by the high-resolution pool
   * selector, whose priority is capture dimensions over capture rate.
   */
  @OptIn(ExperimentalZeroShutterLag::class)
  fun zslDisabledByConfig(): Boolean =
    captureMode() == ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG && prefersHighestResolution()

  /**
   * The mode CameraX actually runs, which captureMode() only requests.
   * ZERO_SHUTTER_LAG falls back to MINIMIZE_LATENCY on a camera without ZSL
   * support and whenever flash is ON or AUTO
   * (developer.android.com/media/camera/camerax/take-photo/zsl).
   */
  fun resolvedCaptureMode(zslSupported: Boolean, flashMode: Int): Int =
    runningCaptureMode(captureMode(), zslSupported, flashMode, zslDisabledByConfig())

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
    /**
     * The mode CameraX runs for a requested mode. Shared with the field capture
     * configs, which request their own mode but fall back by the same rule.
     */
    @OptIn(ExperimentalZeroShutterLag::class)
    fun runningCaptureMode(
      requested: Int,
      zslSupported: Boolean,
      flashMode: Int,
      zslDisabledByConfig: Boolean = false
    ): Int {
      val zslFallsBack =
        zslDisabledByConfig || !zslSupported || flashMode != ImageCapture.FLASH_MODE_OFF
      return if (requested == ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG && zslFallsBack) {
        ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
      } else {
        requested
      }
    }

    fun of(maxDetail: Boolean, motionPriority: Boolean): CaptureTuning =
      entries.first { it.maxDetail == maxDetail && it.motionPriority == motionPriority }

    /**
     * Use this function to choose supported session frame-rate bounds that do
     * not disable automatic low-light boost.
     */
    internal fun selectFrameRateBoundsForLowLightBoost(
      supportedRanges: List<Pair<Int, Int>>,
      lowLightBoostSupported: Boolean
    ): Pair<Int, Int>? {
      val candidates = if (lowLightBoostSupported) {
        supportedRanges.filter { it.second <= LOW_LIGHT_BOOST_MAX_FPS }
      } else {
        supportedRanges
      }
      return candidates.maxWithOrNull(compareBy<Pair<Int, Int>> { it.first }.thenBy { it.second })
    }

    /** Reported in telemetry, so the resolved mode reads by name, not constant. */
    @OptIn(ExperimentalZeroShutterLag::class)
    fun captureModeName(mode: Int): String = when (mode) {
      ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG -> "zero_shutter_lag"
      ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY -> "maximize_quality"
      else -> "minimize_latency"
    }
  }
}
