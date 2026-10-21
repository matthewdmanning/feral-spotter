package expo.modules.nativeidentificationcamera

/**
 * Benchmark numbers for the live detector, summarized once per window of
 * frames and reported as one `detector_stats` diagnostic. One event per window
 * keeps PostHog volume flat however fast the model runs.
 *
 * Analysis thread only.
 */
class DetectorStats(private val windowFrames: Int = 30) {
  private var frames = 0
  private var framesWithDetections = 0
  private var windowStartedNs = 0L
  private val inferenceMs = DoubleArray(windowFrames)
  private var preprocessSum = 0.0
  private var decodeSum = 0.0

  fun record(result: LiveDetector.Result) {
    if (frames == 0) windowStartedNs = System.nanoTime()
    inferenceMs[frames] = result.inferenceMs
    preprocessSum += result.preprocessMs
    decodeSum += result.decodeMs
    if (result.detections.isNotEmpty()) framesWithDetections += 1
    frames += 1
  }

  fun isWindowFull(): Boolean = frames >= windowFrames

  /** Returns the window's summary and starts a new window. */
  fun drain(detector: LiveDetector): Map<String, Any> {
    val elapsedMs = (System.nanoTime() - windowStartedNs) / 1e6
    val sorted = inferenceMs.copyOf(frames).also { it.sort() }
    val summary = mapOf(
      "frames" to frames,
      "fps" to if (elapsedMs > 0) round1(frames * 1000.0 / elapsedMs) else 0.0,
      "inference_ms_p50" to round1(sorted[sorted.size / 2]),
      "inference_ms_p90" to round1(sorted[((sorted.size - 1) * 9) / 10]),
      "inference_ms_max" to round1(sorted.last()),
      "preprocess_ms_mean" to round1(preprocessSum / frames),
      "decode_ms_mean" to round1(decodeSum / frames),
      "frames_with_detections" to framesWithDetections,
      "accelerator" to detector.accelerator,
      "output_layout" to detector.layoutName,
      "output_shape" to detector.outputShapeText
    )
    reset()
    return summary
  }

  fun reset() {
    frames = 0
    framesWithDetections = 0
    preprocessSum = 0.0
    decodeSum = 0.0
  }

  private fun round1(value: Double): Double = Math.round(value * 10.0) / 10.0
}
