package expo.modules.nativeidentificationcamera

import android.hardware.camera2.CameraMetadata
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalZeroShutterLag
import androidx.camera.core.ImageCapture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The failure this guards: a config built with a value the device does not
 * advertise. An unsupported output format makes bindToLifecycle throw, and an
 * unadvertised Camera2 mode is undefined behaviour. So every condition is
 * resolved against every combination of advertised capabilities, from a bare
 * LEGACY-like camera to a FULL one, and each resolved value is checked against
 * what that device advertised.
 */
@OptIn(ExperimentalZeroShutterLag::class)
class FieldCaptureConfigTest {
  private val jpegOnly = setOf(ImageCapture.OUTPUT_FORMAT_JPEG)
  private val withRaw = setOf(
    ImageCapture.OUTPUT_FORMAT_JPEG,
    ImageCapture.OUTPUT_FORMAT_RAW,
    ImageCapture.OUTPUT_FORMAT_RAW_JPEG
  )

  // RAW without RAW+JPEG: CameraX drops RAW+JPEG on devices whose HAL cannot
  // stream both at full size.
  private val rawWithoutJpeg = setOf(ImageCapture.OUTPUT_FORMAT_JPEG, ImageCapture.OUTPUT_FORMAT_RAW)

  private val noiseModeSets = listOf<Set<Int>>(
    emptySet(),
    setOf(CameraMetadata.NOISE_REDUCTION_MODE_FAST),
    setOf(
      CameraMetadata.NOISE_REDUCTION_MODE_OFF,
      CameraMetadata.NOISE_REDUCTION_MODE_FAST,
      CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY
    )
  )
  private val edgeModeSets = listOf<Set<Int>>(
    emptySet(),
    setOf(CameraMetadata.EDGE_MODE_FAST),
    setOf(CameraMetadata.EDGE_MODE_OFF, CameraMetadata.EDGE_MODE_FAST, CameraMetadata.EDGE_MODE_HIGH_QUALITY)
  )
  private val hotPixelModeSets = listOf<Set<Int>>(
    emptySet(),
    setOf(CameraMetadata.HOT_PIXEL_MODE_FAST),
    setOf(CameraMetadata.HOT_PIXEL_MODE_FAST, CameraMetadata.HOT_PIXEL_MODE_HIGH_QUALITY)
  )
  private val stabilizationSets = listOf<Set<Int>>(
    emptySet(),
    setOf(CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_OFF),
    setOf(
      CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_OFF,
      CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON
    )
  )

  private fun devices(): Sequence<FieldCaptureDevice> = sequence {
    for (zsl in listOf(false, true))
      for (formats in listOf(jpegOnly, rawWithoutJpeg, withRaw))
        for (noise in noiseModeSets)
          for (edge in edgeModeSets)
            for (hotPixel in hotPixelModeSets)
              for (stabilization in stabilizationSets)
                yield(FieldCaptureDevice(zsl, formats, noise, edge, hotPixel, stabilization))
  }

  private fun assertAdvertisedOrUnset(value: Int?, advertised: Set<Int>, what: String) {
    if (value != null) assertTrue("$what $value not in $advertised", value in advertised)
  }

  @Test
  fun everyResolvedValueIsOneTheDeviceAdvertises() {
    for (condition in FieldCondition.entries) {
      for (device in devices()) {
        val config = condition.resolve(device)
        val context = "${condition.telemetryName} on $device"

        assertTrue(context, config.outputFormat in device.outputFormats)
        // Upload takes the JPEG, so RAW is only ever written beside one.
        assertTrue(context, config.outputFormat != ImageCapture.OUTPUT_FORMAT_RAW)
        if (config.captureMode == ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG) {
          assertTrue(context, device.zslSupported)
          // CameraX's ZSL reprocess request owns the processing keys.
          assertNull(context, config.noiseReductionMode)
          assertNull(context, config.edgeMode)
          assertNull(context, config.hotPixelMode)
          // Never ZSL with RAW: Camera2 makes them exclusive per request.
          assertEquals(context, ImageCapture.OUTPUT_FORMAT_JPEG, config.outputFormat)
        }
        assertAdvertisedOrUnset(config.noiseReductionMode, device.noiseReductionModes, context)
        assertAdvertisedOrUnset(config.edgeMode, device.edgeModes, context)
        assertAdvertisedOrUnset(config.hotPixelMode, device.hotPixelModes, context)
        assertAdvertisedOrUnset(
          config.opticalStabilizationMode,
          device.opticalStabilizationModes,
          context
        )
        assertTrue(context, config.jpegQuality in 1..100)

        assertPreferenceHonoured(condition, device, config, context)
        assertSettingsNameEveryKeySet(config, context)
      }
    }
  }

  /**
   * The other half of the contract: a safe value is not enough, it must be the
   * condition's most-preferred value the device advertises. Without this a
   * resolver that ignores every preference, or stops asking for RAW, passes.
   */
  private fun assertPreferenceHonoured(
    condition: FieldCondition,
    device: FieldCaptureDevice,
    config: FieldCaptureConfig,
    context: String
  ) {
    val spec = condition.spec
    val expectedMode = spec.captureModes.firstOrNull {
      it != ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG || device.zslSupported
    } ?: ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
    assertEquals(context, expectedMode, config.captureMode)
    assertEquals(
      context,
      spec.outputFormats.first { it in device.outputFormats || it == ImageCapture.OUTPUT_FORMAT_JPEG },
      config.outputFormat
    )
    assertEquals(context, spec.highResolutionPool, config.highResolutionPool)
    assertEquals(context, spec.jpegQuality, config.jpegQuality)

    // Under ZSL the processing keys are deliberately unset (checked above).
    if (config.captureMode != ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG) {
      assertEquals(context, firstIn(spec.noiseReductionModes, device.noiseReductionModes), config.noiseReductionMode)
      assertEquals(context, firstIn(spec.edgeModes, device.edgeModes), config.edgeMode)
      assertEquals(context, firstIn(spec.hotPixelModes, device.hotPixelModes), config.hotPixelMode)
    }
    val oisOn = CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON
    assertEquals(
      context,
      if (spec.opticalStabilization && oisOn in device.opticalStabilizationModes) oisOn else null,
      config.opticalStabilizationMode
    )
  }

  /**
   * The photo's metadata must name what ran: a key set on the still request
   * appears by name, and an unset key is absent rather than reported as a
   * value it never had.
   */
  private fun assertSettingsNameEveryKeySet(config: FieldCaptureConfig, context: String) {
    val settings = CaptureSettings.of(
      tuning = CaptureTuning.NEITHER,
      fieldConfig = config,
      captureMode = config.captureMode,
      jpegQuality = config.jpegQuality,
      frameRateRange = null
    )
    val keys = mapOf(
      "noise_reduction_mode" to config.noiseReductionMode,
      "edge_mode" to config.edgeMode,
      "hot_pixel_mode" to config.hotPixelMode,
      "optical_stabilization_mode" to config.opticalStabilizationMode
    )
    for ((key, value) in keys) {
      if (value == null) {
        assertNull("$context: $key", settings[key])
      } else {
        assertTrue("$context: $key=${settings[key]}", settings[key]?.startsWith("mode_") == false)
      }
    }
    assertEquals(context, config.condition.telemetryName, settings["field_condition"])
    assertEquals(context, FieldCaptureConfig.outputFormatName(config.outputFormat), settings["output_format"])
  }

  private fun firstIn(preferred: List<Int>, advertised: Set<Int>): Int? =
    preferred.firstOrNull { it in advertised }
}
