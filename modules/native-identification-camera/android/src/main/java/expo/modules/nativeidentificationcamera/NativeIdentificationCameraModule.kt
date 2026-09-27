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
      Events("onCameraReady", "onCameraError")

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
