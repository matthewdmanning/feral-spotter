package expo.modules.nativeidentificationcamera

import android.hardware.camera2.CameraMetadata
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalZeroShutterLag
import androidx.camera.core.ImageCapture

/**
 * Candidate still-capture configurations, one per field condition. Each one is
 * a set of preferences; [FieldCondition.resolve] turns it into what this
 * device can actually run.
 *
 * Scope: these configure the ImageCapture use case only — its builder options
 * and Camera2 still-request keys set through the CameraX 1.7 interop API
 * (`ImageCapture.Builder.camera2Interop`). Still-request keys override the
 * repeating request for the still alone, so the preview stream is untouched:
 * no repeating key, frame-rate range or low-light-boost state changes here.
 *
 * Status: CANDIDATES. The values come from the reference docs
 * (docs/references/2026-11-14-android-camera-capture-parameters.md and
 * 2026-11-15-document-camera-behavior.md), not from field captures. Each one
 * needs a device comparison before it becomes a default; the resolved values
 * are reported in diagnostics so a run can name what actually ran.
 */
enum class FieldCondition(
  /** Reported in telemetry and accepted as the `fieldCondition` prop. */
  val telemetryName: String,
  private val spec: FieldCaptureSpec
) {
  /**
   * Dim light: dusk, night, shade under cars and porches.
   *
   * - MAXIMIZE_QUALITY: no ring-buffer frame, the HAL may spend time on
   *   multi-frame processing. Latency matters less than noise here.
   * - Normal-size pool, not the high-resolution one: high-resolution modes on
   *   quad-Bayer sensors read out unbinned pixels, which are noisier in low
   *   light than the binned default size.
   * - RAW+JPEG: the DNG keeps the shadow data the JPEG pipeline crushes.
   * - Noise reduction HIGH_QUALITY, edge FAST: sharpening amplifies noise, so
   *   edge enhancement stays at the no-cost level.
   * - Hot-pixel correction HIGH_QUALITY: long exposures surface hot pixels.
   */
  LOW_LIGHT(
    telemetryName = "low_light",
    spec = FieldCaptureSpec(
      captureModes = listOf(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY),
      highResolutionPool = false,
      outputFormats = RAW_THEN_JPEG,
      jpegQuality = 95,
      noiseReductionModes = listOf(
        CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY,
        CameraMetadata.NOISE_REDUCTION_MODE_FAST
      ),
      edgeModes = listOf(CameraMetadata.EDGE_MODE_FAST),
      hotPixelModes = listOf(
        CameraMetadata.HOT_PIXEL_MODE_HIGH_QUALITY,
        CameraMetadata.HOT_PIXEL_MODE_FAST
      ),
      opticalStabilization = true
    )
  ),

  /**
   * A cat across a lot or street that may bolt.
   *
   * - ZERO_SHUTTER_LAG: returns the buffered frame closest to the press, so
   *   the cat is where the user saw it. Falls back to MINIMIZE_LATENCY where
   *   ZSL is unsupported, and CameraX falls back itself when flash is on.
   * - JPEG only: CameraX does not document ZSL together with RAW, Camera2
   *   makes ZSL reprocessing and DNG capture exclusive per request, and a
   *   full-sensor DNG write lengthens shot-to-shot time.
   * - Normal-size pool: the high-resolution pool "might result in slower
   *   capture times". The default strategy already picks the largest normal
   *   size, and pinch zoom is a view zoom, so the photo stays full field for
   *   a later crop.
   * - Noise reduction and edge FAST: no capture-rate loss. Keys are not set at
   *   all when ZSL runs, so CameraX's ZSL reprocess request owns them.
   */
  DISTANT_MOTION(
    telemetryName = "distant_motion",
    spec = FieldCaptureSpec(
      captureModes = listOf(
        ZERO_SHUTTER_LAG_MODE,
        ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
      ),
      highResolutionPool = false,
      outputFormats = listOf(ImageCapture.OUTPUT_FORMAT_JPEG),
      jpegQuality = 95,
      noiseReductionModes = listOf(CameraMetadata.NOISE_REDUCTION_MODE_FAST),
      edgeModes = listOf(CameraMetadata.EDGE_MODE_FAST),
      hotPixelModes = listOf(CameraMetadata.HOT_PIXEL_MODE_FAST),
      opticalStabilization = true
    )
  ),

  /**
   * A close, still subject where markings decide identification: ear tips,
   * coat pattern, eye colour.
   *
   * - MAXIMIZE_QUALITY with the high-resolution pool: the most pixels the
   *   device offers to CameraX, at the cost of capture time.
   * - RAW+JPEG: the DNG is an unprocessed reference for fine texture.
   * - JPEG quality 100, noise reduction and edge HIGH_QUALITY: the slowest,
   *   best-quality processing path.
   */
  FINE_DETAIL(
    telemetryName = "fine_detail",
    spec = FieldCaptureSpec(
      captureModes = listOf(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY),
      highResolutionPool = true,
      outputFormats = RAW_THEN_JPEG,
      jpegQuality = 100,
      noiseReductionModes = listOf(
        CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY,
        CameraMetadata.NOISE_REDUCTION_MODE_FAST
      ),
      edgeModes = listOf(
        CameraMetadata.EDGE_MODE_HIGH_QUALITY,
        CameraMetadata.EDGE_MODE_FAST
      ),
      hotPixelModes = listOf(
        CameraMetadata.HOT_PIXEL_MODE_HIGH_QUALITY,
        CameraMetadata.HOT_PIXEL_MODE_FAST
      ),
      opticalStabilization = true
    )
  );

  /** Picks the first preference the device advertises, for every setting. */
  fun resolve(device: FieldCaptureDevice): FieldCaptureConfig {
    val captureMode = spec.captureModes.firstOrNull { mode ->
      mode != ZERO_SHUTTER_LAG_MODE || device.zslSupported
    } ?: ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
    val outputFormat = spec.outputFormats.firstOrNull { it in device.outputFormats }
      ?: ImageCapture.OUTPUT_FORMAT_JPEG
    // CameraX's ZSL path reprocesses a buffered frame with its own request.
    // Overriding processing keys on it is untested, so they are left alone.
    val ownsProcessingKeys = captureMode != ZERO_SHUTTER_LAG_MODE
    return FieldCaptureConfig(
      condition = this,
      captureMode = captureMode,
      highResolutionPool = spec.highResolutionPool,
      outputFormat = outputFormat,
      jpegQuality = spec.jpegQuality,
      noiseReductionMode = if (ownsProcessingKeys) {
        firstAdvertised(spec.noiseReductionModes, device.noiseReductionModes)
      } else {
        null
      },
      edgeMode = if (ownsProcessingKeys) {
        firstAdvertised(spec.edgeModes, device.edgeModes)
      } else {
        null
      },
      hotPixelMode = if (ownsProcessingKeys) {
        firstAdvertised(spec.hotPixelModes, device.hotPixelModes)
      } else {
        null
      },
      opticalStabilizationMode = if (
        spec.opticalStabilization &&
        CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON in device.opticalStabilizationModes
      ) {
        CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON
      } else {
        null
      }
    )
  }

  companion object {
    /** null for an absent or unknown prop value: the capture tuning applies. */
    fun fromProp(value: String?): FieldCondition? =
      entries.firstOrNull { it.telemetryName == value }
  }
}

/** One condition's preferences, each list in order of preference. */
data class FieldCaptureSpec(
  val captureModes: List<Int>,
  val highResolutionPool: Boolean,
  val outputFormats: List<Int>,
  val jpegQuality: Int,
  val noiseReductionModes: List<Int>,
  val edgeModes: List<Int>,
  val hotPixelModes: List<Int>,
  val opticalStabilization: Boolean
)

/**
 * What the selected camera advertises, read before the use case is built. An
 * empty mode set means the Camera2 key is absent on this device, so the key is
 * not set and the device default stands.
 */
data class FieldCaptureDevice(
  val zslSupported: Boolean,
  /** `ImageCaptureCapabilities.getSupportedOutputFormats()`. */
  val outputFormats: Set<Int>,
  val noiseReductionModes: Set<Int>,
  val edgeModes: Set<Int>,
  val hotPixelModes: Set<Int>,
  val opticalStabilizationModes: Set<Int>
)

/**
 * A condition resolved against one device: every value here is one the device
 * advertised. A null Camera2 mode means the key is not set.
 */
data class FieldCaptureConfig(
  val condition: FieldCondition,
  val captureMode: Int,
  val highResolutionPool: Boolean,
  val outputFormat: Int,
  val jpegQuality: Int,
  val noiseReductionMode: Int?,
  val edgeMode: Int?,
  val hotPixelMode: Int?,
  val opticalStabilizationMode: Int?
) {
  /** RAW+JPEG writes a DNG beside the JPEG, so a capture takes two files. */
  val writesRaw: Boolean
    get() = outputFormat == ImageCapture.OUTPUT_FORMAT_RAW_JPEG

  /** Every resolved value, by name, for the session_bound diagnostic. */
  fun diagnosticFields(): Map<String, Any> = mapOf(
    "field_condition" to condition.telemetryName,
    "field_capture_mode" to CaptureTuning.captureModeName(captureMode),
    "field_high_resolution_pool" to highResolutionPool,
    "field_output_format" to outputFormatName(outputFormat),
    "field_jpeg_quality" to jpegQuality,
    "field_noise_reduction_mode" to (noiseReductionMode ?: -1),
    "field_edge_mode" to (edgeMode ?: -1),
    "field_hot_pixel_mode" to (hotPixelMode ?: -1),
    "field_optical_stabilization_mode" to (opticalStabilizationMode ?: -1)
  )

  companion object {
    fun outputFormatName(format: Int): String = when (format) {
      ImageCapture.OUTPUT_FORMAT_RAW_JPEG -> "raw_jpeg"
      ImageCapture.OUTPUT_FORMAT_RAW -> "raw"
      ImageCapture.OUTPUT_FORMAT_JPEG_ULTRA_HDR -> "jpeg_ultra_hdr"
      else -> "jpeg"
    }
  }
}

/** RAW is only ever requested with a JPEG beside it: upload takes the JPEG. */
private val RAW_THEN_JPEG = listOf(
  ImageCapture.OUTPUT_FORMAT_RAW_JPEG,
  ImageCapture.OUTPUT_FORMAT_JPEG
)

@OptIn(ExperimentalZeroShutterLag::class)
private const val ZERO_SHUTTER_LAG_MODE = ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG

private fun firstAdvertised(preferred: List<Int>, advertised: Set<Int>): Int? =
  preferred.firstOrNull { it in advertised }
