import AVFoundation

/**
 How the two tuning priorities map to an AVFoundation capture policy.

 This mirrors `CaptureTuning.kt` in shape only: one named table, every
 combination reachable, and the resolved name reported in telemetry so a
 profiling run can tell which mode really ran. The policy itself is not
 mirrored. Android's CameraX capture modes and this platform's quality
 prioritization are different APIs with different behaviour, and copying one
 across to make the two look symmetric is explicitly out of scope.

 OPEN DECISION — what (maxDetail = true, motionPriority = true) should mean.
 This platform resolves that pair to `.balanced`, which is neither priority.
 Android resolves the same pair to zero-shutter-lag. Both props default to true,
 so a default install always takes this branch and `.quality` is never exercised
 by default. The disagreement is left in place deliberately: resolving it is a
 product decision that needs the on-device profiling run, and the telemetry name
 below is what makes that run readable.
 */
enum CaptureTuning: CaseIterable {
  /// Both priorities asked for. Resolves to `.balanced`; see the open decision above.
  case detailAndMotion
  /// Detail only: the one combination that reaches `.quality`.
  case detailOnly
  /// Motion only.
  case motionOnly
  /// Neither priority.
  case neither

  static func of(maxDetail: Bool, motionPriority: Bool) -> CaptureTuning {
    switch (maxDetail, motionPriority) {
    case (true, true): return .detailAndMotion
    case (true, false): return .detailOnly
    case (false, true): return .motionOnly
    case (false, false): return .neither
    }
  }

  /// Reported in telemetry. Matches the Android names so one query spans both platforms.
  var telemetryName: String {
    switch self {
    case .detailAndMotion: return "detail_and_motion"
    case .detailOnly: return "detail_only"
    case .motionOnly: return "motion_only"
    case .neither: return "neither"
    }
  }

  /**
   `.quality` lets the photo pipeline spend more time per frame, which is what
   the detail priority is asking for. `.speed` returns the frame soonest, which
   is the closest this API gets to motion priority. `.balanced` is AVFoundation's
   own middle setting and is what both mixed cases fall back to.
   */
  var qualityPrioritization: AVCapturePhotoOutput.QualityPrioritization {
    switch self {
    case .detailAndMotion: return .balanced
    case .detailOnly: return .quality
    case .motionOnly: return .speed
    case .neither: return .balanced
    }
  }

  /// Whether to ask for the largest photo dimensions the format offers.
  var prefersHighestResolution: Bool {
    self == .detailAndMotion || self == .detailOnly
  }

  /**
   Whether to enable zero-shutter-lag and fast capture prioritization. Both
   return a frame closer to the shutter press, so both belong to the motion
   priority; neither is free, as each holds extra frames in memory.
   */
  var prefersZeroShutterLag: Bool {
    self == .detailAndMotion || self == .motionOnly
  }

  /// Whether to cap exposure so a moving subject stays sharp. Motion priority only.
  var prefersExposureCap: Bool {
    prefersZeroShutterLag
  }
}
