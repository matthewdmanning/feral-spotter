package expo.modules.nativeidentificationcamera

import android.hardware.camera2.CameraMetadata
import androidx.camera.core.ImageCapture

/**
 * The settings one capture ran with, by name, for the photo's metadata. The
 * JS side writes each entry to the photo's Storage object as
 * `camera_<key>`, so a photo exported without metadata.json still says how it
 * was taken.
 *
 * Values are strings because Storage custom metadata holds only strings. A
 * Camera2 key the capture did not set is left out: the device default ran,
 * and no value here could name it.
 */
object CaptureSettings {
  fun of(
    tuning: CaptureTuning,
    fieldConfig: FieldCaptureConfig?,
    captureMode: Int,
    jpegQuality: Int,
    /** "lower-upper" FPS, or null when the session used CameraX's default. */
    frameRateRange: String?
  ): Map<String, String> = buildMap {
    put("capture_tuning", tuning.telemetryName)
    put("capture_mode", CaptureTuning.captureModeName(captureMode))
    put("jpeg_quality", jpegQuality.toString())
    frameRateRange?.let { put("frame_rate_range", it) }
    if (fieldConfig == null) {
      put("output_format", FieldCaptureConfig.outputFormatName(ImageCapture.OUTPUT_FORMAT_JPEG))
      put("high_resolution_pool", tuning.prefersHighestResolution().toString())
      return@buildMap
    }
    put("field_condition", fieldConfig.condition.telemetryName)
    put("output_format", FieldCaptureConfig.outputFormatName(fieldConfig.outputFormat))
    put("high_resolution_pool", fieldConfig.highResolutionPool.toString())
    fieldConfig.noiseReductionMode?.let { put("noise_reduction_mode", noiseReductionName(it)) }
    fieldConfig.edgeMode?.let { put("edge_mode", edgeName(it)) }
    fieldConfig.hotPixelMode?.let { put("hot_pixel_mode", hotPixelName(it)) }
    fieldConfig.opticalStabilizationMode?.let {
      put("optical_stabilization_mode", opticalStabilizationName(it))
    }
  }

  fun noiseReductionName(mode: Int): String = when (mode) {
    CameraMetadata.NOISE_REDUCTION_MODE_OFF -> "off"
    CameraMetadata.NOISE_REDUCTION_MODE_FAST -> "fast"
    CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY -> "high_quality"
    CameraMetadata.NOISE_REDUCTION_MODE_MINIMAL -> "minimal"
    CameraMetadata.NOISE_REDUCTION_MODE_ZERO_SHUTTER_LAG -> "zero_shutter_lag"
    else -> "mode_$mode"
  }

  fun edgeName(mode: Int): String = when (mode) {
    CameraMetadata.EDGE_MODE_OFF -> "off"
    CameraMetadata.EDGE_MODE_FAST -> "fast"
    CameraMetadata.EDGE_MODE_HIGH_QUALITY -> "high_quality"
    CameraMetadata.EDGE_MODE_ZERO_SHUTTER_LAG -> "zero_shutter_lag"
    else -> "mode_$mode"
  }

  fun hotPixelName(mode: Int): String = when (mode) {
    CameraMetadata.HOT_PIXEL_MODE_OFF -> "off"
    CameraMetadata.HOT_PIXEL_MODE_FAST -> "fast"
    CameraMetadata.HOT_PIXEL_MODE_HIGH_QUALITY -> "high_quality"
    else -> "mode_$mode"
  }

  fun opticalStabilizationName(mode: Int): String = when (mode) {
    CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_OFF -> "off"
    CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON -> "on"
    else -> "mode_$mode"
  }
}
