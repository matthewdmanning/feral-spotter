import AVFoundation
import ExpoModulesCore
import NativeIdentificationCamera

private struct SavedCameraState {
  let exposureMode: AVCaptureDevice.ExposureMode
  let automaticLowLightBoost: Bool
}

public final class IosCameraOptimizerModule: Module {
  private var savedStates: [String: SavedCameraState] = [:]
  private let stateLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("IosCameraOptimizer")

    AsyncFunction("configureForIdentification") { (deviceId: String) throws -> Bool in
      guard let device = AVCaptureDevice(uniqueID: deviceId) else {
        return false
      }

      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }

      self.saveStateIfNeeded(for: device)

      if device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposureMode = .continuousAutoExposure
      }

      if device.isLowLightBoostSupported {
        device.automaticallyEnablesLowLightBoostWhenAvailable = false
      }

      guard let exposureCap = CameraExposurePolicy
        .motionPreservingExposureCap(for: device) else {
        return false
      }

      device.activeMaxExposureDuration = exposureCap
      return true
    }

    AsyncFunction("restoreAutomaticCapture") { (deviceId: String) throws -> Bool in
      guard let device = AVCaptureDevice(uniqueID: deviceId) else {
        return false
      }

      let previousState = self.takeSavedState(for: deviceId)

      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }

      // The active format may have changed since optimization was applied.
      // Resetting to AVFoundation's current-format default is safer than
      // restoring a duration captured under a different format.
      device.activeMaxExposureDuration = .invalid

      if let previousState {
        if device.isExposureModeSupported(previousState.exposureMode) {
          device.exposureMode = previousState.exposureMode
        }
        if device.isLowLightBoostSupported {
          device.automaticallyEnablesLowLightBoostWhenAvailable =
            previousState.automaticLowLightBoost
        }
      }

      return true
    }
  }

  private func saveStateIfNeeded(for device: AVCaptureDevice) {
    stateLock.lock()
    defer { stateLock.unlock() }

    guard savedStates[device.uniqueID] == nil else { return }

    savedStates[device.uniqueID] = SavedCameraState(
      exposureMode: device.exposureMode,
      automaticLowLightBoost: device.isLowLightBoostSupported
        ? device.automaticallyEnablesLowLightBoostWhenAvailable
        : false
    )
  }

  private func takeSavedState(for deviceId: String) -> SavedCameraState? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return savedStates.removeValue(forKey: deviceId)
  }
}
