package expo.modules.nativeidentificationcamera

import androidx.camera.core.ImageCapture

/**
 * Settles one RAW+JPEG capture from CameraX's per-file callbacks.
 *
 * CameraX calls OnImageSavedCallback once per file, in no set order. It
 * reports failure two ways (read from the 1.7.0-rc02 RequestWithCallback and
 * TakePictureRequest bytecode):
 *
 * - The whole request fails (capture failed after its retries, camera
 *   closed): the request is aborted, one onError arrives, and neither file
 *   reports again.
 * - One file fails to process or write (ERROR_UNKNOWN, ERROR_FILE_IO): onError
 *   arrives for that file only, and the other file still reports. The
 *   exception does not name the file.
 *
 * So an error that arrives before either file may still be followed by a good
 * JPEG. The photo settles only once the JPEG's fate is known. A per-file
 * error that no second report follows would hold the shutter forever, so the
 * caller arms a [PER_FILE_WAIT_MS] timer while [awaitingOtherFile] is true.
 */
class RawJpegSettlement {
  sealed interface Outcome {
    /** The JPEG is the photo; [rawKept] says whether the DNG is kept beside it. */
    data class Photo(val rawKept: Boolean) : Outcome

    /** No JPEG: the capture fails. */
    data object Failed : Outcome
  }

  private var jpegSaved = false
  private var rawSaved = false
  private var fileFailures = 0

  /** The settled outcome, or null while CameraX may still report. */
  var outcome: Outcome? = null
    private set

  /** True while a per-file error waits for the other file's report. */
  val awaitingOtherFile: Boolean
    get() = outcome == null && fileFailures > 0

  /** Returns the outcome if this report settles the capture, else null. */
  fun onSaved(isRaw: Boolean): Outcome? {
    if (outcome != null) return null
    if (isRaw) rawSaved = true else jpegSaved = true
    return settle()
  }

  /** Returns the outcome if this error settles the capture, else null. */
  fun onError(imageCaptureError: Int): Outcome? {
    if (outcome != null) return null
    if (imageCaptureError in WHOLE_REQUEST_ERRORS) return finish(finalOutcome())
    fileFailures += 1
    return settle()
  }

  /** The other file never reported: settle on what has arrived. */
  fun onTimeout(): Outcome? = if (outcome != null) null else finish(finalOutcome())

  private fun settle(): Outcome? {
    val next = when {
      jpegSaved && rawSaved -> Outcome.Photo(rawKept = true)
      // One file saved and one failed: the failure was the other file.
      jpegSaved && fileFailures > 0 -> Outcome.Photo(rawKept = false)
      rawSaved && fileFailures > 0 -> Outcome.Failed
      fileFailures >= 2 -> Outcome.Failed
      else -> null
    }
    return next?.let(::finish)
  }

  private fun finalOutcome(): Outcome =
    if (jpegSaved) Outcome.Photo(rawKept = rawSaved) else Outcome.Failed

  private fun finish(settled: Outcome): Outcome {
    outcome = settled
    return settled
  }

  companion object {
    /** Errors after which CameraX sends nothing more for the request. */
    val WHOLE_REQUEST_ERRORS = setOf(
      ImageCapture.ERROR_CAPTURE_FAILED,
      ImageCapture.ERROR_CAMERA_CLOSED,
      ImageCapture.ERROR_INVALID_CAMERA
    )

    /**
     * How long a per-file error waits for the other file. Processing the
     * other file is already under way when the error arrives, so this only
     * bounds a report CameraX never sends.
     */
    const val PER_FILE_WAIT_MS = 10_000L
  }
}
