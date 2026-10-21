package expo.modules.nativeidentificationcamera

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class NativeCaptureOptions : Record {
  @Field
  var flashMode: String = "auto"
}

class NativePoint : Record {
  @Field
  var x: Double = 0.0

  @Field
  var y: Double = 0.0
}

class NativeSubjectRegion : Record {
  @Field
  var x: Double = 0.0

  @Field
  var y: Double = 0.0

  @Field
  var width: Double = 0.0

  @Field
  var height: Double = 0.0
}

class NativeIdentificationCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeIdentificationCamera")

    View(NativeIdentificationCameraView::class) {
      Events("onCameraReady", "onCameraError", "onCameraDiagnostic", "onDetections")

      // Expo calls this once after a whole prop batch. The prop setters only
      // record that a rebind is needed, so two settings changed together cost
      // one camera session teardown instead of one each.
      OnViewDidUpdateProps { view: NativeIdentificationCameraView ->
        view.applyPendingConfiguration()
      }

      Prop("isActive") { view: NativeIdentificationCameraView, value: Boolean ->
        view.isActive = value
      }

      Prop("position") { view: NativeIdentificationCameraView, value: String ->
        view.position = value
      }

      Prop("maxDetail") { view: NativeIdentificationCameraView, value: Boolean ->
        view.maxDetail = value
      }

      Prop("motionPriority") { view: NativeIdentificationCameraView, value: Boolean ->
        view.motionPriority = value
      }

      Prop("disableLowLightBoost") { view: NativeIdentificationCameraView, value: Boolean ->
        view.disableLowLightBoost = value
      }

      Prop("subjectMetering") { view: NativeIdentificationCameraView, value: Boolean ->
        view.subjectMetering = value
      }

      Prop("pinchZoom") { view: NativeIdentificationCameraView, value: Boolean ->
        view.pinchZoom = value
      }

      Prop("diagnostics") { view: NativeIdentificationCameraView, value: Boolean ->
        view.diagnostics = value
      }

      Prop("liveDetector") { view: NativeIdentificationCameraView, value: Boolean ->
        view.liveDetector = value
      }

      // Frees the detector model and its analysis thread. Unbinding alone keeps
      // the model loaded, so a flip or a tuning rebind does not reload it.
      OnViewDestroys { view: NativeIdentificationCameraView ->
        view.release()
      }

      AsyncFunction("capture") {
        view: NativeIdentificationCameraView,
        options: NativeCaptureOptions,
        promise: Promise ->
        view.capture(options, promise)
      }

      AsyncFunction("focus") {
        view: NativeIdentificationCameraView,
        point: NativePoint ->
        view.focus(point.x, point.y)
      }

      AsyncFunction("setSubjectRegion") {
        view: NativeIdentificationCameraView,
        region: NativeSubjectRegion? ->
        view.setSubjectRegion(region)
      }
    }
  }
}
