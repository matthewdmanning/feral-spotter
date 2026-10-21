package expo.modules.nativeidentificationcamera

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View

/**
 * Draws the live detector's boxes over the preview. It is a plain View, not a
 * React child, so a frame of boxes costs one invalidate and no bridge traffic.
 *
 * Boxes arrive in view-normalized coordinates (0..1 of this view), which are
 * the coordinates the focus and subject-region calls already use.
 *
 * Touch passes through: this view never claims a gesture, so tap to focus and
 * pinch to zoom keep working under it.
 */
class DetectionOverlayView(context: Context) : View(context) {
  data class Box(val rect: RectF, val label: String)

  private val density = resources.displayMetrics.density

  // Fixed colors on purpose: the overlay sits on a live camera image, not on an
  // app surface, so the app's light and dark theme tokens do not apply here.
  private val boxPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f * density
    color = Color.rgb(255, 196, 0)
  }
  private val labelBackground = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = Color.argb(176, 0, 0, 0)
  }
  private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textSize = 12f * density
  }

  private var boxes: List<Box> = emptyList()
  private val scratch = RectF()

  init {
    isClickable = false
    isFocusable = false
    setWillNotDraw(false)
  }

  /** Main thread only. An empty list clears the overlay. */
  fun show(next: List<Box>) {
    if (next.isEmpty() && boxes.isEmpty()) return
    boxes = next
    invalidate()
  }

  fun clear() = show(emptyList())

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f) return
    val pad = 3f * density
    for (box in boxes) {
      scratch.set(box.rect.left * w, box.rect.top * h, box.rect.right * w, box.rect.bottom * h)
      canvas.drawRect(scratch, boxPaint)
      if (box.label.isEmpty()) continue
      val textWidth = labelPaint.measureText(box.label)
      val textHeight = labelPaint.textSize
      val labelTop = (scratch.top - textHeight - 2 * pad).coerceAtLeast(0f)
      canvas.drawRect(
        scratch.left,
        labelTop,
        scratch.left + textWidth + 2 * pad,
        labelTop + textHeight + 2 * pad,
        labelBackground
      )
      canvas.drawText(box.label, scratch.left + pad, labelTop + pad + textHeight * 0.85f, labelPaint)
    }
  }
}
