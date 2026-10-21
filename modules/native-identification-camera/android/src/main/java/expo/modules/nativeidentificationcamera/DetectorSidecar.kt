package expo.modules.nativeidentificationcamera

import android.content.res.AssetManager
import org.json.JSONObject
import java.io.FileNotFoundException

/**
 * The detector's sidecar, `assets/detector/detector.json`, written by
 * `scripts/detector/export-detector.py` next to `detector.tflite`.
 *
 * Both files are gitignored (the yolo26n benchmark weights are AGPL-3.0), so a
 * fresh checkout has neither. [load] returns null in that case and the view
 * reports `detector_unavailable` with `reason: model_missing` instead of
 * failing the camera session.
 */
data class DetectorSidecar(
  val source: String,
  val imgsz: Int,
  val endToEnd: Boolean,
  val labels: List<String>,
  /** Indices into [labels]. Empty keeps every class. */
  val targetClasses: Set<Int>,
  val scoreThreshold: Float
) {
  companion object {
    const val MODEL_ASSET = "detector/detector.tflite"
    const val SIDECAR_ASSET = "detector/detector.json"
    private const val SUPPORTED_VERSION = 1

    fun load(assets: AssetManager): DetectorSidecar? {
      val text = try {
        assets.open(SIDECAR_ASSET).bufferedReader().use { it.readText() }
      } catch (missing: FileNotFoundException) {
        return null
      }
      return parse(text)
    }

    fun parse(text: String): DetectorSidecar {
      val json = JSONObject(text)
      val version = json.optInt("version", -1)
      require(version == SUPPORTED_VERSION) {
        "detector.json version $version is not supported (expected $SUPPORTED_VERSION)"
      }
      val labelArray = json.getJSONArray("labels")
      val labels = List(labelArray.length()) { labelArray.getString(it) }
      require(labels.isNotEmpty()) { "detector.json has no labels" }
      val targetArray = json.optJSONArray("targets")
      val targets = if (targetArray == null) {
        emptySet()
      } else {
        (0 until targetArray.length()).map { i ->
          val name = targetArray.getString(i)
          val index = labels.indexOf(name)
          require(index >= 0) { "detector.json target '$name' is not a label" }
          index
        }.toSet()
      }
      val imgsz = json.getInt("imgsz")
      require(imgsz > 0) { "detector.json imgsz must be positive" }
      return DetectorSidecar(
        source = json.optString("source", "unknown"),
        imgsz = imgsz,
        endToEnd = json.optBoolean("end2end", false),
        labels = labels,
        targetClasses = targets,
        scoreThreshold = json.optDouble("scoreThreshold", 0.35).toFloat()
      )
    }
  }
}
