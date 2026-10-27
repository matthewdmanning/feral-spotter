package expo.modules.nativeidentificationcamera

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ViewZoomTest {
  private val delta = 1e-4f
  private fun zoom(limits: ViewZoomLimits = ViewZoomLimits()) = ViewZoom.initial(limits)

  @Test
  fun startsUnzoomedAtOneTimes() {
    assertFalse(zoom().isZoomed)
    assertEquals(1f, zoom().scale, delta)
  }

  @Test
  fun scaleStopsAtTheConfiguredLimits() {
    val limits = ViewZoomLimits(minScale = 1f, maxScale = 3f)
    val zoomedIn = zoom(limits).scaledBy(10f)
    assertEquals(3f, zoomedIn.scale, delta)
    assertEquals(1f, zoomedIn.scaledBy(0.01f).scale, delta)
  }

  @Test
  fun theScreenCentreIsAlwaysThePreviewCentre() {
    assertEquals(0.5f, zoom().scaledBy(4f).previewFraction(0.5f), delta)
  }

  @Test
  fun aTapNearAZoomedEdgeReachesTowardTheCentreOfThePreview() {
    // At 4x the screen shows the middle quarter of the preview.
    val zoomed = zoom().scaledBy(4f)
    assertEquals(0.375f, zoomed.previewFraction(0f), delta)
    assertEquals(0.625f, zoomed.previewFraction(1f), delta)
  }

  @Test
  fun unzoomedATapIsThePreviewPoint() {
    assertEquals(0.25f, zoom().previewFraction(0.25f), delta)
  }

  @Test
  fun resetReturnsToOneTimes() {
    val reset = zoom().scaledBy(3f).reset()
    assertFalse(reset.isZoomed)
    assertTrue(reset.scale == 1f)
  }
}
