import AVFoundation
import ExpoModulesCore

struct NativeCaptureOptions: Record {
  @Field
  var flashMode: String = "auto"
}

struct NativePoint: Record {
  @Field
  var x: Double = 0

  @Field
  var y: Double = 0
}

struct NativeSubjectRegion: Record {
  @Field
  var x: Double = 0

  @Field
  var y: Double = 0

  @Field
  var width: Double = 0

  @Field
  var height: Double = 0
}

public final class NativeIdentificationCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeIdentificationCamera")

    View(NativeIdentificationCameraView.self) {
      Events("onCameraReady", "onCameraError")

      Prop("isActive") { (view: NativeIdentificationCameraView, value: Bool) in
        view.isActive = value
      }

      Prop("position") { (view: NativeIdentificationCameraView, value: String) in
        view.position = value == "front" ? .front : .back
      }

      Prop("maxDetail") { (view: NativeIdentificationCameraView, value: Bool) in
        view.maxDetail = value
      }

      Prop("motionPriority") { (view: NativeIdentificationCameraView, value: Bool) in
        view.motionPriority = value
      }

      Prop("disableLowLightBoost") { (view: NativeIdentificationCameraView, value: Bool) in
        view.disableLowLightBoost = value
      }

      Prop("subjectMetering") { (view: NativeIdentificationCameraView, value: Bool) in
        view.subjectMetering = value
      }

      AsyncFunction("capture") {
        (view: NativeIdentificationCameraView, options: NativeCaptureOptions, promise: Promise) in
        view.capture(options: options, promise: promise)
      }

      AsyncFunction("focus") {
        (view: NativeIdentificationCameraView, point: NativePoint) -> Bool in
        view.focus(normalizedX: point.x, normalizedY: point.y)
      }

      AsyncFunction("setSubjectRegion") {
        (view: NativeIdentificationCameraView, region: NativeSubjectRegion?) -> Bool in
        view.setSubjectRegion(region)
      }
    }
  }
}
