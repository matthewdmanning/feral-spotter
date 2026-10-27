package expo.modules.nativeidentificationcamera

/** How far the preview may be magnified. */
data class ViewZoomLimits(
  val minScale: Float = 1f,
  // Past this the preview stream is too coarse to show more.
  val maxScale: Float = 5f
)

/**
 * The scale of the preview about the view's centre. The zoom never pans, so the
 * centre of the preview stays the centre of the screen.
 *
 * Immutable and free of Android types, so the maths runs in a plain JVM unit
 * test. Every change goes through `of`, which holds the one place the limits
 * are applied.
 */
class ViewZoom private constructor(
  val limits: ViewZoomLimits,
  val scale: Float
) {
  val isZoomed: Boolean get() = scale > limits.minScale

  fun reset(): ViewZoom = of(limits, limits.minScale)

  fun scaledBy(scaleFactor: Float): ViewZoom = of(limits, scale * scaleFactor)

  /**
   * Where a point on screen falls in the preview, as a fraction of the preview.
   * The inverse of the scale, on either axis.
   */
  fun previewFraction(screenFraction: Float): Float =
    0.5f + (screenFraction - 0.5f) / scale

  companion object {
    fun initial(limits: ViewZoomLimits = ViewZoomLimits()): ViewZoom =
      ViewZoom(limits, limits.minScale)

    private fun of(limits: ViewZoomLimits, scale: Float): ViewZoom =
      ViewZoom(limits, scale.coerceIn(limits.minScale, limits.maxScale))
  }
}
