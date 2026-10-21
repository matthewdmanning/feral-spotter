package expo.modules.nativeidentificationcamera

/**
 * One detection in the coordinates of the upright frame that was fed to the
 * model, normalized to 0..1 on each axis. Upright means after the analysis
 * frame's rotationDegrees was applied, so "top" is the top of the scene.
 */
data class Detection(
  val left: Float,
  val top: Float,
  val right: Float,
  val bottom: Float,
  val score: Float,
  val classIndex: Int
)

/**
 * Where the upright frame sits inside the square model input. The frame is
 * scaled by [scale] and centered, and the rest is padding, so a box in model
 * pixels maps back with (value - pad) / scale.
 */
data class Letterbox(
  val inputSize: Int,
  val frameWidth: Int,
  val frameHeight: Int,
  val scale: Float,
  val padX: Float,
  val padY: Float
) {
  companion object {
    fun of(inputSize: Int, frameWidth: Int, frameHeight: Int): Letterbox {
      val scale = minOf(
        inputSize.toFloat() / frameWidth,
        inputSize.toFloat() / frameHeight
      )
      val scaledWidth = Math.round(frameWidth * scale)
      val scaledHeight = Math.round(frameHeight * scale)
      return Letterbox(
        inputSize = inputSize,
        frameWidth = frameWidth,
        frameHeight = frameHeight,
        scale = scale,
        padX = ((inputSize - scaledWidth) / 2).toFloat(),
        padY = ((inputSize - scaledHeight) / 2).toFloat()
      )
    }
  }
}

/**
 * Decodes the two output layouts an Ultralytics LiteRT detect export can have.
 * The layout is read from the output shape. The sidecar's `end2end` flag only
 * breaks a tie that the shape cannot settle (see [layoutOf]).
 *
 * End-to-end head (YOLO26 default with nms=False): shape [1, N, 6]. Each row is
 * x1, y1, x2, y2, score, class. Boxes are in model-input pixels. The model has
 * already removed duplicates, so no NMS runs here.
 *
 * Raw one-to-many head (nms=None, or any INT8 export): shape [1, 4 + C, A] or
 * [1, A, 4 + C]. The first four channels are cx, cy, w, h normalized by the
 * input size, and the rest are per-class scores after sigmoid. NMS runs here.
 *
 * Both layouts were checked against yolo26n exports from ultralytics 8.4.183
 * on one cat photograph (the parity check in the implementation note).
 */
class YoloDecoder(
  private val numClasses: Int,
  /** Class indices to keep. Empty keeps every class. */
  private val targetClasses: Set<Int>,
  private val scoreThreshold: Float,
  private val iouThreshold: Float = 0.45f,
  private val maxDetections: Int = 20
) {
  enum class Layout { END_TO_END, RAW_CHANNELS_FIRST, RAW_ANCHORS_FIRST }

  /**
   * [endToEndHint] is the sidecar's `end2end` flag. The shape decides alone
   * except for a two-class model, where an end-to-end row and a raw
   * anchors-first row are both 6 wide.
   */
  fun layoutOf(shape: IntArray, endToEndHint: Boolean): Layout {
    require(shape.size == 3 && shape[0] == 1) {
      "Unsupported detector output shape ${shape.contentToString()}"
    }
    val channels = 4 + numClasses
    return when {
      shape[1] == channels && shape[2] != channels -> Layout.RAW_CHANNELS_FIRST
      shape[2] == 6 && (channels != 6 || endToEndHint) -> Layout.END_TO_END
      shape[2] == channels -> Layout.RAW_ANCHORS_FIRST
      else -> throw IllegalArgumentException(
        "Output shape ${shape.contentToString()} does not match $numClasses classes"
      )
    }
  }

  fun decode(output: FloatArray, layout: Layout, shape: IntArray, letterbox: Letterbox): List<Detection> =
    when (layout) {
      Layout.END_TO_END -> decodeEndToEnd(output, shape[1], letterbox)
      Layout.RAW_CHANNELS_FIRST -> decodeRaw(output, shape[2], letterbox, channelsFirst = true)
      Layout.RAW_ANCHORS_FIRST -> decodeRaw(output, shape[1], letterbox, channelsFirst = false)
    }

  private fun keeps(classIndex: Int): Boolean =
    targetClasses.isEmpty() || classIndex in targetClasses

  private fun decodeEndToEnd(output: FloatArray, rows: Int, letterbox: Letterbox): List<Detection> {
    val result = ArrayList<Detection>()
    for (row in 0 until rows) {
      val base = row * 6
      val score = output[base + 4]
      if (score < scoreThreshold) continue
      val classIndex = Math.round(output[base + 5])
      if (!keeps(classIndex)) continue
      toFrame(
        output[base], output[base + 1], output[base + 2], output[base + 3],
        score, classIndex, letterbox
      )?.let(result::add)
    }
    result.sortByDescending { it.score }
    return if (result.size > maxDetections) result.subList(0, maxDetections) else result
  }

  private fun decodeRaw(
    output: FloatArray,
    anchors: Int,
    letterbox: Letterbox,
    channelsFirst: Boolean
  ): List<Detection> {
    val channels = 4 + numClasses
    fun at(channel: Int, anchor: Int): Float =
      if (channelsFirst) output[channel * anchors + anchor] else output[anchor * channels + channel]

    val size = letterbox.inputSize.toFloat()
    val candidates = ArrayList<Detection>()
    for (anchor in 0 until anchors) {
      var bestScore = 0f
      var bestClass = -1
      for (c in 0 until numClasses) {
        if (!keeps(c)) continue
        val s = at(4 + c, anchor)
        if (s > bestScore) {
          bestScore = s
          bestClass = c
        }
      }
      if (bestClass < 0 || bestScore < scoreThreshold) continue
      val cx = at(0, anchor) * size
      val cy = at(1, anchor) * size
      val halfW = at(2, anchor) * size / 2f
      val halfH = at(3, anchor) * size / 2f
      toFrame(cx - halfW, cy - halfH, cx + halfW, cy + halfH, bestScore, bestClass, letterbox)
        ?.let(candidates::add)
    }
    return nonMaxSuppression(candidates)
  }

  /** Class-aware greedy NMS over frame-normalized boxes. */
  private fun nonMaxSuppression(candidates: MutableList<Detection>): List<Detection> {
    candidates.sortByDescending { it.score }
    val kept = ArrayList<Detection>()
    for (candidate in candidates) {
      if (kept.size >= maxDetections) break
      val overlaps = kept.any {
        it.classIndex == candidate.classIndex && iou(it, candidate) > iouThreshold
      }
      if (!overlaps) kept.add(candidate)
    }
    return kept
  }

  private fun iou(a: Detection, b: Detection): Float {
    val w = minOf(a.right, b.right) - maxOf(a.left, b.left)
    val h = minOf(a.bottom, b.bottom) - maxOf(a.top, b.top)
    if (w <= 0f || h <= 0f) return 0f
    val inter = w * h
    val union = (a.right - a.left) * (a.bottom - a.top) +
      (b.right - b.left) * (b.bottom - b.top) - inter
    return if (union <= 0f) 0f else inter / union
  }

  /**
   * Model-input pixels to upright-frame 0..1, clipped to the frame. The
   * end-to-end head can place an edge outside the input (the parity photo gave
   * x1 = -7 px), so the clip is required, not defensive.
   */
  private fun toFrame(
    x1: Float,
    y1: Float,
    x2: Float,
    y2: Float,
    score: Float,
    classIndex: Int,
    letterbox: Letterbox
  ): Detection? {
    val w = letterbox.frameWidth.toFloat()
    val h = letterbox.frameHeight.toFloat()
    val left = ((x1 - letterbox.padX) / letterbox.scale / w).coerceIn(0f, 1f)
    val top = ((y1 - letterbox.padY) / letterbox.scale / h).coerceIn(0f, 1f)
    val right = ((x2 - letterbox.padX) / letterbox.scale / w).coerceIn(0f, 1f)
    val bottom = ((y2 - letterbox.padY) / letterbox.scale / h).coerceIn(0f, 1f)
    if (right <= left || bottom <= top) return null
    return Detection(left, top, right, bottom, score, classIndex)
  }
}
