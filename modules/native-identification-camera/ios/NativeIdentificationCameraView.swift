import AVFoundation
import CoreMedia
import ExpoModulesCore
import UIKit

final class NativePhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let completion: (Result<[String: Any], Error>) -> Void
  private var processedResult: Result<[String: Any], Error>?
  private var outputURL: URL?
  private var didComplete = false

  init(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    self.completion = completion
  }

  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    guard processedResult == nil, !didComplete else { return }

    if let error {
      processedResult = .failure(error)
      return
    }

    guard let data = photo.fileDataRepresentation() else {
      processedResult = .failure(NativeCameraError.photoDataUnavailable)
      return
    }

    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension("jpg")
    outputURL = url
    do {
      try data.write(to: url, options: .atomic)
      let dimensions = photo.resolvedSettings.photoDimensions
      processedResult = .success([
        "uri": url.absoluteString,
        "width": Int(dimensions.width),
        "height": Int(dimensions.height),
        "capturedAt": ISO8601DateFormatter().string(from: Date())
      ])
    } catch {
      try? FileManager.default.removeItem(at: url)
      outputURL = nil
      processedResult = .failure(error)
    }
  }

  /** Use this function to settle the buffered result and clean up once the capture ends. */
  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings,
    error: Error?
  ) {
    guard !didComplete else { return }
    didComplete = true

    if let error {
      if let outputURL {
        try? FileManager.default.removeItem(at: outputURL)
      }
      completion(.failure(error))
      return
    }

    completion(processedResult ?? .failure(NativeCameraError.photoDataUnavailable))
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
  let onCameraDiagnostic = EventDispatcher()
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
  private var defaultFormats: [String: AVCaptureDevice.Format] = [:]
  private var sessionGeneration: UInt = 0
  private var rotationCoordinator: Any?
  private var previewRotationObservation: NSKeyValueObservation?
  private var captureRotationObservation: NSKeyValueObservation?

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

  var diagnostics = false

  /**
   Pinch to zoom. Off by default, matching Android: a zoomed capture is a
   cropped capture, and an identification photograph is worth more at full
   sensor width. The recognizer stays installed and is enabled or disabled,
   because adding and removing it would race the gesture it is recognizing.
   */
  var pinchZoom = false {
    didSet { pinchRecognizer.isEnabled = pinchZoom }
  }

  private lazy var pinchRecognizer = UIPinchGestureRecognizer(
    target: self,
    action: #selector(handlePinch(_:))
  )

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    previewLayer.videoGravity = .resizeAspectFill
    previewLayer.session = session
    pinchRecognizer.isEnabled = pinchZoom
    addGestureRecognizer(pinchRecognizer)
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
      self.session.beginConfiguration()
      self.configureDevicePolicy(device)
      self.configureOutput(for: device)
      self.session.commitConfiguration()
    }
  }

  private func selectDevice() -> AVCaptureDevice? {
    let types: [AVCaptureDevice.DeviceType]
    if position == .front {
      types = [.builtInTrueDepthCamera, .builtInWideAngleCamera]
    } else {
      types = [
        .builtInTripleCamera,
        .builtInDualWideCamera,
        .builtInDualCamera,
        .builtInWideAngleCamera
      ]
    }

    for type in types {
      if let device = AVCaptureDevice.default(type, for: .video, position: position) {
        return device
      }
    }
    return nil
  }

  private func configureSession() {
    sessionGeneration &+= 1
    session.beginConfiguration()
    session.sessionPreset = .photo

    if let currentInput {
      session.removeInput(currentInput)
      self.currentInput = nil
      self.currentDevice = nil
    }

    do {
      guard let device = selectDevice() else {
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

      if defaultFormats[device.uniqueID] == nil {
        defaultFormats[device.uniqueID] = device.activeFormat
      }
      configureDevicePolicy(device)
      configureOutput(for: device)
      session.commitConfiguration()

      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        self.configureOrientation(for: device)
        self.onCameraReady([:])
        self.diagnostic(
          "session_bound",
          [
            "camera_position": self.position == .front ? "front" : "back",
            "max_detail": self.maxDetail,
            "motion_priority": self.motionPriority,
            "low_light_boost_disabled": self.disableLowLightBoost
          ]
        )
      }
      updateRunningState()
    } catch {
      session.commitConfiguration()
      DispatchQueue.main.async { [weak self] in
        self?.onCameraError(["message": String(describing: error)])
        self?.diagnostic(
          "session_bind_failed",
          ["message": String(describing: error)]
        )
      }
    }
  }

  private func photoPixelCount(_ format: AVCaptureDevice.Format) -> Int64 {
    format.supportedMaxPhotoDimensions
      .map { Int64($0.width) * Int64($0.height) }
      .max() ?? 0
  }

  private func configureFormat(_ device: AVCaptureDevice) {
    if !maxDetail {
      if let original = defaultFormats[device.uniqueID] {
        device.activeFormat = original
      }
      return
    }

    guard let bestFormat = device.formats.max(by: {
      photoPixelCount($0) < photoPixelCount($1)
    }) else {
      return
    }

    if photoPixelCount(bestFormat) > photoPixelCount(device.activeFormat) {
      device.activeFormat = bestFormat
    }
  }

  private func configureOutput(for device: AVCaptureDevice) {
    let supportedDimensions = device.activeFormat.supportedMaxPhotoDimensions
    if maxDetail, let dimensions = supportedDimensions.max(by: {
      Int64($0.width) * Int64($0.height) < Int64($1.width) * Int64($1.height)
    }) {
      photoOutput.maxPhotoDimensions = dimensions
    } else if let dimensions = supportedDimensions.min(by: {
      Int64($0.width) * Int64($0.height) < Int64($1.width) * Int64($1.height)
    }) {
      photoOutput.maxPhotoDimensions = dimensions
    }

    photoOutput.maxPhotoQualityPrioritization = qualityPrioritization

    if #available(iOS 17.0, *) {
      photoOutput.isZeroShutterLagEnabled =
        motionPriority && photoOutput.isZeroShutterLagSupported
      photoOutput.isFastCapturePrioritizationEnabled =
        motionPriority && photoOutput.isFastCapturePrioritizationSupported
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

      configureFormat(device)

      if device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusMode = .continuousAutoFocus
      }
      if device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposureMode = .continuousAutoExposure
      }

      if device.isLowLightBoostSupported {
        device.automaticallyEnablesLowLightBoostWhenAvailable = true
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

  private func configureOrientation(for device: AVCaptureDevice) {
    previewRotationObservation = nil
    captureRotationObservation = nil
    rotationCoordinator = nil

    if #available(iOS 17.0, *) {
      let coordinator = AVCaptureDevice.RotationCoordinator(
        device: device,
        previewLayer: previewLayer
      )
      rotationCoordinator = coordinator

      previewRotationObservation = coordinator.observe(
        \.videoRotationAngleForHorizonLevelPreview,
        options: [.initial, .new]
      ) { [weak self] coordinator, _ in
        guard let connection = self?.previewLayer.connection else { return }
        let angle = coordinator.videoRotationAngleForHorizonLevelPreview
        if connection.isVideoRotationAngleSupported(angle) {
          connection.videoRotationAngle = angle
        }
      }

      captureRotationObservation = coordinator.observe(
        \.videoRotationAngleForHorizonLevelCapture,
        options: [.initial, .new]
      ) { [weak self] coordinator, _ in
        guard let connection = self?.photoOutput.connection(with: .video) else {
          return
        }
        let angle = coordinator.videoRotationAngleForHorizonLevelCapture
        if connection.isVideoRotationAngleSupported(angle) {
          connection.videoRotationAngle = angle
        }
      }
    } else {
      previewLayer.connection?.videoOrientation = .portrait
      photoOutput.connection(with: .video)?.videoOrientation = .portrait
    }
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
        self.diagnostic("session_unbound")
      }
    }
  }

  @objc
  private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    let scale = gesture.scale
    gesture.scale = 1
    sessionQueue.async { [weak self] in
      guard let self, let device = self.currentDevice else { return }
      do {
        try device.lockForConfiguration()
        defer { device.unlockForConfiguration() }
        let requested = device.videoZoomFactor * scale
        device.videoZoomFactor = min(
          max(requested, device.minAvailableVideoZoomFactor),
          device.maxAvailableVideoZoomFactor
        )
      } catch {
        DispatchQueue.main.async {
          self.onCameraError(["message": String(describing: error)])
        }
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

      #if DEBUG
      let dimensions = self.photoOutput.maxPhotoDimensions
      assert(
        device.activeFormat.supportedMaxPhotoDimensions.contains {
          $0.width == dimensions.width && $0.height == dimensions.height
        },
        "photo dimensions must belong to the active format"
      )
      #endif
      settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions

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
        guard let self else {
          switch result {
          case .success(let value): promise.resolve(value)
          case .failure(let error): promise.reject(error)
          }
          return
        }
        self.sessionQueue.async {
          self.captureDelegates[id] = nil
          switch result {
          case .success(let value):
            self.diagnostic(
              "capture_saved",
              [
                "output_width": value["width"] as? Int ?? 0,
                "output_height": value["height"] as? Int ?? 0
              ]
            )
            promise.resolve(value)
          case .failure(let error):
            self.diagnostic(
              "capture_failed",
              ["message": String(describing: error)]
            )
            promise.reject(error)
          }
        }
      }
      self.captureDelegates[id] = delegate
      self.photoOutput.capturePhoto(with: settings, delegate: delegate)
    }
  }

  func focus(normalizedX: Double, normalizedY: Double, promise: Promise) {
    requestMeteringPoint(
      normalizedX: normalizedX,
      normalizedY: normalizedY,
      owner: "tap",
      promise: promise
    )
  }

  func setSubjectRegion(_ region: NativeSubjectRegion?, promise: Promise) {
    guard subjectMetering, let region else {
      diagnostic(
        "subject_region_ignored",
        [
          "subject_metering": subjectMetering,
          "region_present": region != nil
        ]
      )
      promise.resolve(false)
      return
    }
    requestMeteringPoint(
      normalizedX: region.x + region.width / 2,
      normalizedY: region.y + region.height / 2,
      owner: "subject",
      promise: promise
    )
  }

  /** Use this function to convert preview coordinates on the main queue and apply them only to the current lens session. */
  private func requestMeteringPoint(
    normalizedX: Double,
    normalizedY: Double,
    owner: String,
    promise: Promise
  ) {
    guard normalizedX >= 0,
          normalizedX <= 1,
          normalizedY >= 0,
          normalizedY <= 1 else {
      diagnostic(
        "focus_requested",
        ["owner": owner, "accepted": false, "reason": "out_of_bounds"]
      )
      promise.resolve(false)
      return
    }

    sessionQueue.async { [weak self] in
      guard let self, let device = self.currentDevice else {
        self?.diagnostic(
          "focus_requested",
          ["owner": owner, "accepted": false, "reason": "no_bound_camera"]
        )
        promise.resolve(false)
        return
      }
      let generation = self.sessionGeneration
      let deviceID = device.uniqueID
      self.diagnostic(
        "focus_requested",
        ["owner": owner, "accepted": true, "reason": "started"]
      )

      DispatchQueue.main.async { [weak self] in
        guard let self else {
          promise.resolve(false)
          return
        }
        guard self.bounds.width > 0, self.bounds.height > 0 else {
          promise.resolve(false)
          return
        }

        let layerPoint = CGPoint(
          x: self.bounds.width * normalizedX,
          y: self.bounds.height * normalizedY
        )
        let devicePoint = self.previewLayer.captureDevicePointConverted(
          fromLayerPoint: layerPoint
        )

        self.sessionQueue.async { [weak self] in
          guard let self else {
            promise.resolve(false)
            return
          }
          guard self.sessionGeneration == generation,
                self.currentDevice?.uniqueID == deviceID,
                self.session.isRunning else {
            self.diagnostic(
              "focus_request_completed",
              ["owner": owner, "success": false, "reason": "stale_session"]
            )
            promise.resolve(false)
            return
          }

          let success = self.applyMeteringPoint(devicePoint, includeExposure: true)
          self.diagnostic(
            "focus_request_completed",
            [
              "owner": owner,
              "success": success,
              "reason": success ? "applied" : "configuration_failed"
            ]
          )
          promise.resolve(success)
        }
      }
    }
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

  /** Use this function to emit opt-in session, capture, and focus diagnostics to the JavaScript consumer. */
  private func diagnostic(_ event: String, _ fields: [String: Any] = [:]) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.diagnostics else { return }
      self.onCameraDiagnostic(fields.merging(["event": event]) { current, _ in current })
    }
  }

  deinit {
    previewRotationObservation = nil
    captureRotationObservation = nil
    if session.isRunning {
      session.stopRunning()
    }
  }
}
