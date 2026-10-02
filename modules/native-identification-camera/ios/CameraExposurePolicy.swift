import AVFoundation
import CoreMedia

/**
 The one exposure heuristic shared by both AVFoundation capture paths.

 Two modules set an exposure cap on the same `AVCaptureDevice`: this module's
 native capture view, and `IosCameraOptimizerModule`, which applies the same
 policy to the VisionCamera path. They carried a copy each. The copies agreed,
 but nothing kept them in agreement, and they would diverge in exactly the
 condition the heuristic exists for. One copy lives here.

 What the cap is for: a long exposure brightens a dark frame, but an animal in
 the frame moves during it, and a motion-blurred photo cannot be identified. So
 the cap trades brightness for a sharp subject, and it applies only when the
 caller asked for motion priority.

 How the value is chosen:

 - Start from the system cap, `activeMaxExposureDuration`, which is what
   AVFoundation would allow on its own.
 - Take the minimum frame duration as well. At the session's frame rate, an
   exposure longer than one frame cannot complete per frame, so the frame
   duration is the tighter practical bound whenever it is shorter.
 - Keep whichever of the two is shorter, because the shorter one is the one
   that actually preserves motion.
 - Clamp into the active format's supported range. A duration outside
   `minExposureDuration ... maxExposureDuration` is rejected by the device, and
   the range is a property of the format, so it can change when the format does.

 A duration is only usable if it is valid, finite and positive. AVFoundation
 reports `.invalid` for "no cap" and an indefinite time for "unknown", and both
 would compare wrongly against a real duration.
 */
public enum CameraExposurePolicy {
  /**
   The longest exposure that still preserves subject motion on this device, or
   `nil` when the device reports no usable duration at all. `nil` means the
   caller should leave the device's own cap alone rather than guess one.
   */
  public static func motionPreservingExposureCap(for device: AVCaptureDevice) -> CMTime? {
    let format = device.activeFormat
    let systemCap = device.activeMaxExposureDuration
    let frameDuration = device.activeVideoMinFrameDuration

    var candidate: CMTime?
    if isUsableDuration(systemCap) {
      candidate = systemCap
    }
    if isUsableDuration(frameDuration) {
      candidate = candidate.map {
        CMTimeCompare(frameDuration, $0) < 0 ? frameDuration : $0
      } ?? frameDuration
    }

    guard var cap = candidate else { return nil }

    if CMTimeCompare(cap, format.minExposureDuration) < 0 {
      cap = format.minExposureDuration
    }
    if CMTimeCompare(cap, format.maxExposureDuration) > 0 {
      cap = format.maxExposureDuration
    }
    return cap
  }

  /// Whether AVFoundation reported a real duration rather than "none" or "unknown".
  public static func isUsableDuration(_ duration: CMTime) -> Bool {
    duration.isValid &&
      !duration.isIndefinite &&
      CMTimeCompare(duration, .zero) > 0
  }
}
