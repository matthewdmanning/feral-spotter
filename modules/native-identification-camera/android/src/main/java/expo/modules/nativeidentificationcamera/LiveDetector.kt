package expo.modules.nativeidentificationcamera

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.FileNotFoundException
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Runs the bundled detector on one analysis frame at a time.
 *
 * Not thread safe, by design: the view creates, runs and closes it on the one
 * analysis executor thread. LiteRT documents that a GPU delegate must run on
 * the thread that created it.
 *
 * Runtime: LiteRT 1.4.2, the classic Interpreter with the GPU delegate. The
 * newer 2.x CompiledModel API was the first choice, but its AARs carry Kotlin
 * 2.3/2.4 metadata and this project compiles with Kotlin 2.1, which reads up
 * to 2.2. The 1.4.2 classes are Java, so they compile here. GPU is used when
 * LiteRT's CompatibilityList allows it; CPU (XNNPACK) is the fallback.
 *
 * Preprocessing matches Ultralytics prediction: the upright frame is scaled to
 * fit the square input, centered, padded with gray 114, and fed as RGB in
 * 0..1. The input layout ([1, 3, H, W] or [1, H, W, 3]) and the output shape
 * come from the model's own tensors.
 */
class LiveDetector private constructor(
  val sidecar: DetectorSidecar,
  private val interpreter: Interpreter,
  private val gpuDelegate: GpuDelegate?,
  /** "gpu" or "cpu": the path that compiled and ran the warm-up. */
  val accelerator: String,
  /** Why GPU was not used, when [accelerator] is "cpu". */
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

  /** Model load plus delegate setup plus one warm-up run, in milliseconds. */
  var loadMs: Long = 0L
    private set

  private val inputShape: IntArray = interpreter.getInputTensor(0).shape()
  private val outputShape: IntArray = interpreter.getOutputTensor(0).shape()
  private val planarInput: Boolean
  private val size: Int

  init {
    require(inputShape.size == 4 && inputShape[0] == 1) {
      "Unsupported detector input shape ${inputShape.contentToString()}"
    }
    planarInput = inputShape[1] == 3
    size = if (planarInput) inputShape[2] else inputShape[1]
    val width = if (planarInput) inputShape[3] else inputShape[2]
    require(size == width) { "Detector input must be square, got ${inputShape.contentToString()}" }
    require(planarInput || inputShape[3] == 3) {
      "Detector input has no RGB axis: ${inputShape.contentToString()}"
    }
  }

  private val decoder = YoloDecoder(
    numClasses = sidecar.labels.size,
    targetClasses = sidecar.targetClasses,
    scoreThreshold = sidecar.scoreThreshold
  )

  /** Read from the output tensor once; the sidecar only breaks a tie. */
  private val layout: YoloDecoder.Layout = decoder.layoutOf(outputShape, sidecar.endToEnd)

  private val letterboxBitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
  private val letterboxCanvas = Canvas(letterboxBitmap)
  private val pixels = IntArray(size * size)
  private val inputBuffer: ByteBuffer = directFloats(3 * size * size)
  private val inputFloats: FloatBuffer = inputBuffer.asFloatBuffer()
  private val outputBuffer: ByteBuffer = directFloats(outputShape.fold(1) { a, b -> a * b })
  private val outputValues = FloatArray(outputBuffer.capacity() / 4)
  private val drawMatrix = Matrix()
  private val bounds = RectF()
  private val drawPaint = Paint(Paint.FILTER_BITMAP_FLAG)

  val inputSize: Int
    get() = size

  val layoutName: String
    get() = layout.name.lowercase()

  val outputShapeText: String
    get() = outputShape.contentToString()

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
    inputBuffer.rewind()
    outputBuffer.rewind()
    interpreter.run(inputBuffer, outputBuffer)
    outputBuffer.rewind()
    outputBuffer.asFloatBuffer().get(outputValues)

    val t2 = System.nanoTime()
    val detections = decoder.decode(outputValues, layout, outputShape, letterbox)
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
    inputFloats.rewind()
    if (planarInput) {
      for (i in 0 until plane) inputFloats.put(i, ((pixels[i] shr 16) and 0xFF) * INV_255)
      for (i in 0 until plane) inputFloats.put(plane + i, ((pixels[i] shr 8) and 0xFF) * INV_255)
      for (i in 0 until plane) inputFloats.put(2 * plane + i, (pixels[i] and 0xFF) * INV_255)
    } else {
      for (i in 0 until plane) {
        val p = pixels[i]
        val o = i * 3
        inputFloats.put(o, ((p shr 16) and 0xFF) * INV_255)
        inputFloats.put(o + 1, ((p shr 8) and 0xFF) * INV_255)
        inputFloats.put(o + 2, (p and 0xFF) * INV_255)
      }
    }
  }

  override fun close() {
    interpreter.close()
    gpuDelegate?.close()
    letterboxBitmap.recycle()
  }

  companion object {
    private const val INV_255 = 1f / 255f
    private val PAD_COLOR = Color.rgb(114, 114, 114)
    private const val CPU_THREADS = 4

    private fun directFloats(count: Int): ByteBuffer =
      ByteBuffer.allocateDirect(count * 4).order(ByteOrder.nativeOrder())

    /** Blocking: loads the model, sets up the delegate and warms up. Call off the main thread. */
    fun open(assets: AssetManager): Opened {
      val sidecar = try {
        DetectorSidecar.load(assets) ?: return Opened.Missing
      } catch (error: Throwable) {
        return Opened.Failed("detector.json: ${error.message ?: error}")
      }
      // Read into a direct buffer rather than memory-mapping, so loading does
      // not depend on whether the build compressed the asset.
      val model = try {
        assets.open(DetectorSidecar.MODEL_ASSET).use { stream ->
          val bytes = stream.readBytes()
          ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).apply {
            put(bytes)
            rewind()
          }
        }
      } catch (missing: FileNotFoundException) {
        return Opened.Missing
      } catch (error: IOException) {
        return Opened.Failed("detector.tflite: ${error.message ?: error}")
      }

      val gpuFailure = try {
        return Opened.Ready(build(model, sidecar, useGpu = true, gpuFailure = null))
      } catch (error: Throwable) {
        error.message ?: error.toString()
      }
      return try {
        Opened.Ready(build(model, sidecar, useGpu = false, gpuFailure = gpuFailure))
      } catch (error: Throwable) {
        Opened.Failed("gpu: $gpuFailure; cpu: ${error.message ?: error}")
      }
    }

    private fun build(
      model: ByteBuffer,
      sidecar: DetectorSidecar,
      useGpu: Boolean,
      gpuFailure: String?
    ): LiveDetector {
      val startedAt = System.nanoTime()
      val options = Interpreter.Options()
      var delegate: GpuDelegate? = null
      if (useGpu) {
        val compatibility = CompatibilityList()
        try {
          check(compatibility.isDelegateSupportedOnThisDevice) {
            "GPU delegate not supported on this device"
          }
          delegate = GpuDelegate(compatibility.bestOptionsForThisDevice)
          options.addDelegate(delegate)
        } finally {
          compatibility.close()
        }
      } else {
        options.setNumThreads(CPU_THREADS)
      }

      var interpreter: Interpreter? = null
      try {
        model.rewind()
        interpreter = Interpreter(model, options)
        val detector = LiveDetector(
          sidecar = sidecar,
          interpreter = interpreter,
          gpuDelegate = delegate,
          accelerator = if (useGpu) "gpu" else "cpu",
          gpuFailure = gpuFailure
        )
        // One warm-up run, so the first camera frame does not pay for
        // delegate compilation, and so a GPU that loads but cannot run falls
        // back to CPU here instead of failing on a live frame.
        detector.warmUp()
        detector.loadMs = (System.nanoTime() - startedAt) / 1_000_000
        return detector
      } catch (error: Throwable) {
        interpreter?.close()
        delegate?.close()
        throw error
      }
    }
  }

  private fun warmUp() {
    inputBuffer.rewind()
    outputBuffer.rewind()
    interpreter.run(inputBuffer, outputBuffer)
  }
}
