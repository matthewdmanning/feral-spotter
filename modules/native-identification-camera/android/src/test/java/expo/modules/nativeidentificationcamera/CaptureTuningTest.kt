package expo.modules.nativeidentificationcamera

import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalZeroShutterLag
import androidx.camera.core.ImageCapture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The failure this guards: a ZSL request is reported as ZSL even though the
 * high-resolution configuration, flash, or device capability forces latency
 * mode. The cases cover the configuration flag and the supported boundaries.
 */
@OptIn(ExperimentalZeroShutterLag::class)
class CaptureTuningTest {
  /** Use this function to verify the high-resolution selector disables ZSL only for that tuning. */
  @Test
  fun highResolutionZslConfigurationIsExplicitlyDisabled() {
    assertTrue(CaptureTuning.DETAIL_AND_MOTION.zslDisabledByConfig())
    assertFalse(CaptureTuning.MOTION_ONLY.zslDisabledByConfig())
    assertFalse(CaptureTuning.DETAIL_ONLY.zslDisabledByConfig())
    assertFalse(CaptureTuning.NEITHER.zslDisabledByConfig())

    assertEquals(
      ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY,
      CaptureTuning.runningCaptureMode(
        ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG,
        zslSupported = true,
        flashMode = ImageCapture.FLASH_MODE_OFF,
        zslDisabledByConfig = true
      )
    )
    assertEquals(
      ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY,
      CaptureTuning.DETAIL_AND_MOTION.resolvedCaptureMode(
        zslSupported = true,
        flashMode = ImageCapture.FLASH_MODE_OFF
      )
    )
  }

  /** Use this function to verify flash and unsupported-camera ZSL fallbacks. */
  @Test
  fun zslFallsBackForFlashOrUnsupportedCamera() {
    val zsl = ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG
    val latency = ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY

    assertEquals(latency, CaptureTuning.runningCaptureMode(zsl, false, ImageCapture.FLASH_MODE_OFF))
    assertEquals(latency, CaptureTuning.runningCaptureMode(zsl, true, ImageCapture.FLASH_MODE_ON))
    assertEquals(latency, CaptureTuning.runningCaptureMode(zsl, true, ImageCapture.FLASH_MODE_AUTO))
    assertEquals(zsl, CaptureTuning.runningCaptureMode(zsl, true, ImageCapture.FLASH_MODE_OFF))
  }
}
