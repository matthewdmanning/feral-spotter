package expo.modules.nativeidentificationcamera

import androidx.camera.core.ImageCapture
import expo.modules.nativeidentificationcamera.RawJpegSettlement.Outcome
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The failure this guards: a good JPEG lost, or a shutter held forever, by
 * misreading CameraX's RAW+JPEG callbacks. It happened once: an error that
 * arrived first was taken for the whole request, so a DNG write failure
 * discarded a photo CameraX went on to save.
 *
 * The model is CameraX 1.7.0-rc02's behaviour, read from its bytecode. Each
 * file ends saved or with its own error (ERROR_UNKNOWN, ERROR_FILE_IO), in
 * either order; or the whole request fails (ERROR_CAPTURE_FAILED,
 * ERROR_CAMERA_CLOSED, ERROR_INVALID_CAMERA) after zero or one file reports,
 * and nothing reports after it. Every such history is driven, and the outcome
 * is derived from the history itself, not from the class under test.
 */
class RawJpegSettlementTest {
  private sealed interface Event {
    data class Saved(val raw: Boolean) : Event
    data class Error(val code: Int) : Event
  }

  private enum class Fate { SAVED, UNKNOWN_ERROR, FILE_IO_ERROR }

  private fun report(raw: Boolean, fate: Fate): Event = when (fate) {
    Fate.SAVED -> Event.Saved(raw)
    Fate.UNKNOWN_ERROR -> Event.Error(ImageCapture.ERROR_UNKNOWN)
    Fate.FILE_IO_ERROR -> Event.Error(ImageCapture.ERROR_FILE_IO)
  }

  /** Both files report their own fate, in either order. */
  private fun perFileHistories(): List<Pair<List<Event>, Outcome>> =
    Fate.entries.flatMap { rawFate ->
      Fate.entries.flatMap { jpegFate ->
        val raw = report(raw = true, rawFate)
        val jpeg = report(raw = false, jpegFate)
        val expected = if (jpegFate == Fate.SAVED) {
          Outcome.Photo(rawKept = rawFate == Fate.SAVED)
        } else {
          Outcome.Failed
        }
        listOf(listOf(raw, jpeg) to expected, listOf(jpeg, raw) to expected)
      }
    }

  /** The whole request fails after zero or one file reports. */
  private fun wholeRequestHistories(): List<Pair<List<Event>, Outcome>> =
    RawJpegSettlement.WHOLE_REQUEST_ERRORS.flatMap { code ->
      val prefixes = listOf(emptyList<Event>()) +
        listOf(true, false).flatMap { raw -> Fate.entries.map { listOf(report(raw, it)) } }
      prefixes.map { prefix ->
        val jpegSaved = Event.Saved(raw = false) in prefix
        val rawSaved = Event.Saved(raw = true) in prefix
        val expected = if (jpegSaved) Outcome.Photo(rawKept = rawSaved) else Outcome.Failed
        (prefix + Event.Error(code)) to expected
      }
    }

  private fun RawJpegSettlement.feed(event: Event): Outcome? = when (event) {
    is Event.Saved -> onSaved(event.raw)
    is Event.Error -> onError(event.code)
  }

  @Test
  fun everyCameraXHistorySettlesOnceOnItsLastReportWithTheRightOutcome() {
    for ((history, expected) in perFileHistories() + wholeRequestHistories()) {
      val settlement = RawJpegSettlement()
      history.dropLast(1).forEach { event ->
        assertNull("$history settled early at $event", settlement.feed(event))
      }
      assertEquals("$history", expected, settlement.feed(history.last()))
      assertEquals("$history", expected, settlement.outcome)
      if (expected is Outcome.Photo) {
        assertEquals(
          "$history delivered format",
          if (expected.rawKept) "raw_jpeg" else "jpeg",
          expected.deliveredFormat
        )
      }
      // Settled, so no timer is left to fire and nothing late changes it.
      assertFalse("$history", settlement.awaitingOtherFile)
      assertNull("$history", settlement.feed(Event.Saved(raw = false)))
      assertNull("$history", settlement.onTimeout())
      assertEquals("$history", expected, settlement.outcome)
    }
  }

  @Test
  fun aPerFileErrorThatNothingFollowsFailsOnTheTimeoutInsteadOfHolding() {
    for (code in listOf(ImageCapture.ERROR_UNKNOWN, ImageCapture.ERROR_FILE_IO)) {
      val settlement = RawJpegSettlement()
      assertNull(settlement.onError(code))
      assertTrue(settlement.awaitingOtherFile)
      assertEquals(Outcome.Failed, settlement.onTimeout())
      assertFalse(settlement.awaitingOtherFile)
    }
  }

  /** Use this function to verify a missing second file settles on the delivered JPEG. */
  @Test
  fun aSavedJpegWithoutRawSettlesAsJpegOnTimeout() {
    val settlement = RawJpegSettlement()

    assertNull(settlement.onSaved(isRaw = false))
    assertTrue(settlement.awaitingOtherFile)
    val outcome = settlement.onTimeout()

    assertEquals(Outcome.Photo(rawKept = false), outcome)
    assertEquals("jpeg", (outcome as Outcome.Photo).deliveredFormat)
  }
}
