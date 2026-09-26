import AVFoundation
import CoreMedia
import ExpoModulesCore
import UIKit

final class NativePhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let completion: (Result<[String: Any], Error>) -> Void

  init(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    self.completion = completion
  }

  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    if let error {
      completion(.failure(error))
      return
    }

    guard let data = photo.fileDataRepresentation() else {
      completion(.failure(NativeCameraError.photoDataUnavailable))
      return
    }

    do {
      let url = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension("jpg")
      try data.write(to: url, options: .atomic)
      let dimensions = photo.resolvedSettings.photoDimensions
      completion(.success([
        "uri": url.absoluteString,
        "width": Int(dimensions.width),
        "height": Int(dimensions.height),
        "capturedAt": ISO8601DateFormatter().string(from: Date())
      ]))
    } catch {
      completion(.failure(error))
    }
  }
}

enum NativeCameraError: Error {
  case noCamera
  case cannotAddInput
  case cannotAddOutput
  case notReady
  case photoDataUnavailable
}

public final class NativeIdentificationCameraView: ExpoView {
  public override class var layerClass: AnyClass {
    AVCaptureVideoPreviewLayer.self
  }

  private var previewLayer: AVCaptureVideoPreviewLayer {
    layer as! AVCaptureVideoPreviewLayer
  }

  let onCameraReady = EventDispatcher()
  let onCameraError = EventDispatcher()

  private let session = AVCaptureSession()
  private let photoOutput = AVCapturePhotoOutput()
  private let sessionQueue = DispatchQueue(
    label: "com.feralspotter.native-identification-camera",
    qos: .userInitiated
  )

  private var currentInput: AVCaptureDeviceInput?
  private var currentDevice: AVCaptureDevice?
  private var captureDelegates: [Int64: NativePhotoCaptureDelegate] = [:]
  private var defaultPhotoDimensions: [String: CMVideoDimensions] = [:]

  var isActive = false {
    didSet { updateRunningState() }
  }

  var position = AVCaptureDevice.Position.back {
    didSet {
      guard oldValue != position else { return }
      reconfigure()
    }
  }

  var maxDetail = true {
    didSet {
      guard oldValue != maxDetail else { return }
      reconfigurePolicy()
    }
  }

  var motionPriority = true {
    didSet {
      guard oldValue != motionPriority else { return }
      reconfigurePolicy()
    }
  }

  var disableLowLightBoost = false {
    didSet {
      guard oldValue != disableLowLightBoost else { return }
      reconfigurePolicy()
    }
  }

  var subjectMetering = false

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    previewLayer.videoGravity = .resizeAspectFill
    previewLayer.session = session
    reconfigure()
  }

  private func reconfigure() {
    sessionQueue.async { [weak self] in
      self?.configureSession()
    }
  }

  private func reconfigurePolicy() {
    sessionQueue.async { [weak self] in
      guard let self, let device = self.currentDevice else { return }
      self.configureOutput(for: device)
      self.configureDevicePolicy(device)
    }
  }

  private func configureSession() {
    session.beginConfiguration()
    session.sessionPreset = .photo

    if let currentInput {
      session.removeInput(currentInput)
      self.currentInput = nil
    }

    do {
      guard let device = AVCaptureDevice.default(
        .builtInWideAngleCamera,
        for: .video,
        position: position
      ) else {
        throw NativeCameraError.noCamera
      }

      let input = try AVCaptureDeviceInput(device: device)
      guard session.canAddInput(input) else {
        throw NativeCameraError.cannotAddInput
      }
      session.addInput(input)
      currentInput = input
      currentDevice = device

      if !session.outputs.contains(photoOutput) {
        guard session.canAddOutput(photoOutput) else {
          throw NativeCameraError.cannotAddOutput
        }
        session.addOutput(photoOutput)
      }

      if defaultPhotoDimensions[device.uniqueID] == nil {
        defaultPhotoDimensions[device.uniqueID] = photoOutput.maxPhotoDimensions
      }

      configureOutput(for: device)
      configureDevicePolicy(device)
      session.commitConfiguration()

      DispatchQueue.main.async { [weak self] in
        self?.onCameraReady([:])
      }
      updateRunningState()
    } catch {
      session.commitConfiguration()
      DispatchQueue.main.async { [weak self] in
        self?.onCameraError(["message": String(describing: error)])
      }
    }
  }

  private func configureOutput(for device: AVCaptureDevice) {
    let priority = qualityPrioritization
    photoOutput.maxPhotoQualityPrioritization = priority

    if #available(iOS 17.0, *) {
      photoOutput.isZeroShutterLagEnabled =
        motionPriority && photoOutput.isZeroShutterLagSupported
      photoOutput.isFastCapturePrioritizationEnabled =
        motionPriority && photoOutput.isFastCapturePrioritizationSupported
    }

    if maxDetail,
       let largest = device.activeFormat.supportedMaxPhotoDimensions.max(by: {
         Int64($0.width) * Int64($0.height) < Int64($1.width) * Int64($1.height)
       }) {
      photoOutput.maxPhotoDimensions = largest
    } else if let original = defaultPhotoDimensions[device.uniqueID],
              original.width > 0,
              original.height > 0 {
      photoOutput.maxPhotoDimensions = original
    }
  }

  private var qualityPrioritization: AVCapturePhotoOutput.QualityPrioritization {
    switch (maxDetail, motionPriority) {
    case (true, true):
      return .balanced
    case (true, false):
      return .quality
    case (false, true):
      return .speed
    case (false, false):
      return .balanced
    }
  }

  private func configureDevicePolicy(_ device: AVCaptureDevice) {
    do {
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }

      if device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusMode = .continuousAutoFocus
      }
      if device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposureMode = .continuousAutoExposure
      }

      if device.isLowLightBoostSupported && disableLowLightBoost {
        device.automaticallyEnablesLowLightBoostWhenAvailable = false
      }

      if motionPriority, let cap = motionPreservingExposureCap(for: device) {
        device.activeMaxExposureDuration = cap
      } else {
        device.activeMaxExposureDuration = .invalid
      }
    } catch {
      DispatchQueue.main.async { [weak self] in
        self?.onCameraError(["message": String(describing: error)])
      }
    }
  }

  private func motionPreservingExposureCap(for device: AVCaptureDevice) -> CMTime? {
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

  private func isUsableDuration(_ duration: CMTime) -> Bool {
    duration.isValid &&
      !duration.isIndefinite &&
      CMTimeCompare(duration, .zero) > 0
  }

  private func updateRunningState() {
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if self.isActive {
        if !self.session.isRunning {
          self.session.startRunning()
        }
      } else if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  func capture(options: NativeCaptureOptions, promise: Promise) {
    sessionQueue.async { [weak self] in
      guard let self,
            self.session.isRunning,
            let device = self.currentDevice else {
        promise.reject(NativeCameraError.notReady)
        return
      }

      let settings = AVCapturePhotoSettings(
        format: [AVVideoCodecKey: AVVideoCodecType.jpeg]
      )
      settings.photoQualityPrioritization = self.qualityPrioritization

      if self.maxDetail {
        settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions
      }

      switch options.flashMode {
      case "on":
        if device.isFlashAvailable { settings.flashMode = .on }
      case "auto":
        if device.isFlashAvailable { settings.flashMode = .auto }
      default:
        settings.flashMode = .off
      }

      let id = settings.uniqueID
      let delegate = NativePhotoCaptureDelegate { [weak self] result in
        self?.sessionQueue.async {
          self?.captureDelegates[id] = nil
        }
        switch result {
        case .success(let value):
          promise.resolve(value)
        case .failure(let error):
          promise.reject(error)
        }
      }
      self.captureDelegates[id] = delegate
      self.photoOutput.capturePhoto(with: settings, delegate: delegate)
    }
  }

  func focus(normalizedX: Double, normalizedY: Double) -> Bool {
    guard normalizedX >= 0,
          normalizedX <= 1,
          normalizedY >= 0,
          normalizedY <= 1 else {
      return false
    }

    let layerPoint = CGPoint(
      x: bounds.width * normalizedX,
      y: bounds.height * normalizedY
    )
    let devicePoint = previewLayer.captureDevicePointConverted(fromLayerPoint: layerPoint)
    return applyMeteringPoint(devicePoint, includeExposure: true)
  }

  func setSubjectRegion(_ region: NativeSubjectRegion?) -> Bool {
    guard subjectMetering, let region else { return false }
    let centerX = region.x + region.width / 2
    let centerY = region.y + region.height / 2
    return focus(normalizedX: centerX, normalizedY: centerY)
  }

  private func applyMeteringPoint(
    _ point: CGPoint,
    includeExposure: Bool
  ) -> Bool {
    guard let device = currentDevice else { return false }

    do {
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }

      if device.isFocusPointOfInterestSupported,
         device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusPointOfInterest = point
        device.focusMode = .continuousAutoFocus
      }
      if includeExposure,
         device.isExposurePointOfInterestSupported,
         device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposurePointOfInterest = point
        device.exposureMode = .continuousAutoExposure
      }
      return true
    } catch {
      return false
    }
  }

  deinit {
    if session.isRunning {
      session.stopRunning()
    }
  }
}
