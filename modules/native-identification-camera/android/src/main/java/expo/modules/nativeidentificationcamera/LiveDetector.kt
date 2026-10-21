package expo.modules.nativeidentificationcamera

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import com.google.ai.edge.litert.Accelerator
import com.google.ai.edge.litert.CompiledModel
import com.google.ai.edge.litert.TensorBuffer
import java.io.FileNotFoundException
import java.io.IOException

/**
 * Runs the bundled detector on one analysis frame at a time.
 *
 * Not thread safe, by design: the view creates, runs and closes it on the one
 * analysis executor thread. LiteRT's GPU path is documented as thread-bound for
 * the classic delegate, and keeping the CompiledModel on one thread avoids the
 * question for the newer API too.
 *
 * Runtime: LiteRT 2.3.0 CompiledModel, the API Google now recommends. Its
 * Interpreter is CPU-only in 2.x. GPU is tried first, then CPU (XNNPACK).
 *
 * Preprocessing matches Ultralytics prediction: the upright frame is scaled to
 * fit the square input, centered, padded with gray 114, and fed as RGB in
 * 0..1. litert-torch exports keep PyTorch's planar [1, 3, H, W] input.
 */
class LiveDetector private constructor(
  val sidecar: DetectorSidecar,
  private val model: CompiledModel,
  private val inputs: List<TensorBuffer>,
  private val outputs: List<TensorBuffer>,
  /** "gpu" or "cpu": the accelerator that compiled and ran the warm-up. */
  val accelerator: String,
  /** Model load plus compile plus one warm-up run, in milliseconds. */
  val loadMs: Long,
  /** Why GPU was skipped, when [accelerator] is "cpu". */
  val gpuFailure: String?
) : AutoCloseable {

  data class Result(
    val detections: List<Detection>,
    /** Size of the upright frame the detections are normalized to. */
    val uprightWidth: Int,
    val uprightHeight: Int,
    val preprocessMs: Double,
    val inferenceMs: Double,
    val decodeMs: Double
  )

  sealed class Opened {
    class Ready(val detector: LiveDetector) : Opened()

    /** The gitignored model files were not exported into this build. */
    object Missing : Opened()

    class Failed(val message: String) : Opened()
  }

  private val size = sidecar.imgsz
  private val decoder = YoloDecoder(
    numClasses = sidecar.labels.size,
    targetClasses = sidecar.targetClasses,
    scoreThreshold = sidecar.scoreThreshold
  )
  private val letterboxBitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
  private val letterboxCanvas = Canvas(letterboxBitmap)
  private val pixels = IntArray(size * size)
  private val inputValues = FloatArray(3 * size * size)
  private val drawMatrix = Matrix()
  private val bounds = RectF()
  private val drawPaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private var outputShape: IntArray? = null
  private var layout: YoloDecoder.Layout? = null

  /** The decoder's reading of the output tensor, once a frame has run. */
  val layoutName: String?
    get() = layout?.name?.lowercase()

  val outputShapeText: String?
    get() = outputShape?.contentToString()

  /**
   * [frame] is the analysis buffer as stored by the sensor; [rotationDegrees]
   * is the clockwise turn that makes it upright (ImageInfo.rotationDegrees).
   */
  fun detect(frame: Bitmap, rotationDegrees: Int): Result {
    val t0 = System.nanoTime()
    val quarterTurned = rotationDegrees % 180 != 0
    val uprightWidth = if (quarterTurned) frame.height else frame.width
    val uprightHeight = if (quarterTurned) frame.width else frame.height
    val letterbox = Letterbox.of(size, uprightWidth, uprightHeight)
    fillInput(frame, rotationDegrees, letterbox)

    val t1 = System.nanoTime()
    inputs[0].writeFloat(inputValues)
    model.run(inputs, outputs)
    val output = outputs[0].readFloat()

    val t2 = System.nanoTime()
    val shape = outputShape ?: shapeOf(output.size).also { outputShape = it }
    val resolvedLayout = layout ?: decoder.layoutOf(shape, sidecar.endToEnd).also { layout = it }
    val detections = decoder.decode(output, resolvedLayout, shape, letterbox)
    val t3 = System.nanoTime()

    return Result(
      detections = detections,
      uprightWidth = uprightWidth,
      uprightHeight = uprightHeight,
      preprocessMs = (t1 - t0) / 1e6,
      inferenceMs = (t2 - t1) / 1e6,
      decodeMs = (t3 - t2) / 1e6
    )
  }

  private fun fillInput(frame: Bitmap, rotationDegrees: Int, letterbox: Letterbox) {
    drawMatrix.reset()
    drawMatrix.postRotate(rotationDegrees.toFloat())
    bounds.set(0f, 0f, frame.width.toFloat(), frame.height.toFloat())
    drawMatrix.mapRect(bounds)
    drawMatrix.postTranslate(-bounds.left, -bounds.top)
    drawMatrix.postScale(letterbox.scale, letterbox.scale)
    drawMatrix.postTranslate(letterbox.padX, letterbox.padY)

    letterboxCanvas.drawColor(PAD_COLOR)
    letterboxCanvas.drawBitmap(frame, drawMatrix, drawPaint)
    letterboxBitmap.getPixels(pixels, 0, size, 0, 0, size, size)

    val plane = size * size
    if (sidecar.planarInput) {
      for (i in 0 until plane) {
        val p = pixels[i]
        inputValues[i] = ((p shr 16) and 0xFF) * INV_255
        inputValues[plane + i] = ((p shr 8) and 0xFF) * INV_255
        inputValues[2 * plane + i] = (p and 0xFF) * INV_255
      }
    } else {
      for (i in 0 until plane) {
        val p = pixels[i]
        val o = i * 3
        inputValues[o] = ((p shr 16) and 0xFF) * INV_255
        inputValues[o + 1] = ((p shr 8) and 0xFF) * INV_255
        inputValues[o + 2] = (p and 0xFF) * INV_255
      }
    }
  }

  /**
   * CompiledModel reads outputs as flat arrays, so the shape is rebuilt from
   * the element count. End-to-end rows are 6 wide; the raw Ultralytics head is
   * channels-first, [1, 4 + C, anchors]. The count decides when only one of
   * the two fits. The sidecar's `end2end` flag decides only a count that fits
   * both, so a stale sidecar cannot turn a raw head into garbage boxes.
   */
  private fun shapeOf(count: Int): IntArray {
    val channels = 4 + sidecar.labels.size
    val endToEndRows = count / 6
    // Ultralytics' end-to-end head keeps max_det rows (300 by default).
    val fitsEndToEnd = count % 6 == 0 && endToEndRows in 1..MAX_END_TO_END_ROWS
    val fitsRaw = count % channels == 0 && count / channels > MAX_END_TO_END_ROWS
    return when {
      fitsEndToEnd && (!fitsRaw || sidecar.endToEnd) -> intArrayOf(1, endToEndRows, 6)
      fitsRaw -> intArrayOf(1, channels, count / channels)
      else -> throw IllegalArgumentException(
        "Output has $count values: neither [1, N<=$MAX_END_TO_END_ROWS, 6] nor [1, $channels, A]"
      )
    }
  }

  override fun close() {
    inputs.forEach { it.close() }
    outputs.forEach { it.close() }
    model.close()
    letterboxBitmap.recycle()
  }

  companion object {
    private const val INV_255 = 1f / 255f
    private val PAD_COLOR = Color.rgb(114, 114, 114)
    private const val CPU_THREADS = 4
    private const val MAX_END_TO_END_ROWS = 1000

    /** Blocking: loads, compiles and warms up the model. Call off the main thread. */
    fun open(assets: AssetManager): Opened {
      val sidecar = try {
        DetectorSidecar.load(assets) ?: return Opened.Missing
      } catch (error: Throwable) {
        return Opened.Failed("detector.json: ${error.message ?: error}")
      }
      try {
        assets.open(DetectorSidecar.MODEL_ASSET).close()
      } catch (missing: FileNotFoundException) {
        return Opened.Missing
      } catch (error: IOException) {
        return Opened.Failed("detector.tflite: ${error.message ?: error}")
      }

      val gpuFailure = try {
        return Opened.Ready(compile(assets, sidecar, Accelerator.GPU, null))
      } catch (error: Throwable) {
        error.message ?: error.toString()
      }
      return try {
        Opened.Ready(compile(assets, sidecar, Accelerator.CPU, gpuFailure))
      } catch (error: Throwable) {
        Opened.Failed("gpu: $gpuFailure; cpu: ${error.message ?: error}")
      }
    }

    private fun compile(
      assets: AssetManager,
      sidecar: DetectorSidecar,
      accelerator: Accelerator,
      gpuFailure: String?
    ): LiveDetector {
      val startedAt = System.nanoTime()
      val options = CompiledModel.Options(accelerator)
      if (accelerator == Accelerator.CPU) {
        options.cpuOptions = CompiledModel.CpuOptions(numThreads = CPU_THREADS)
      }
      val model = CompiledModel.create(assets, DetectorSidecar.MODEL_ASSET, options)
      var inputs: List<TensorBuffer> = emptyList()
      var outputs: List<TensorBuffer> = emptyList()
      try {
        inputs = model.createInputBuffers()
        outputs = model.createOutputBuffers()
        // One warm-up run, so the first camera frame does not pay for shader
        // compilation, and so a GPU that compiles but cannot run falls back.
        inputs[0].writeFloat(FloatArray(3 * sidecar.imgsz * sidecar.imgsz))
        model.run(inputs, outputs)
        outputs[0].readFloat()
      } catch (error: Throwable) {
        inputs.forEach { it.close() }
        outputs.forEach { it.close() }
        model.close()
        throw error
      }
      val loadMs = (System.nanoTime() - startedAt) / 1_000_000
      return LiveDetector(
        sidecar = sidecar,
        model = model,
        inputs = inputs,
        outputs = outputs,
        accelerator = accelerator.name.lowercase(),
        loadMs = loadMs,
        gpuFailure = gpuFailure
      )
    }
  }
}
