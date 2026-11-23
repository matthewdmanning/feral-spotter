import AVFoundation
import CoreMedia
import ExpoModulesCore
import UIKit

/**
 One capture, one settlement.

 `didFinishProcessingPhoto` carries the photo; its result is buffered.
 `didFinishCaptureFor` is AVFoundation's terminal callback: it arrives even when
 no photo was produced, and settles with the buffered result. The view can also
 settle a capture from outside, when the session stops or the view is recycled
 and AVFoundation may never deliver the terminal callback.

 Every path goes through `settle`, which fires the completion exactly once under
 a lock. A failure that wins the race deletes any photo file already written.
 */
final class NativePhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let completion: (Result<[String: Any], Error>) -> Void
  private let settlementLock = NSLock()
  private var processedResult: Result<[String: Any], Error>?
  private var outputURL: URL?
  private var hasSettled = false

  init(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    self.completion = completion
  }

  /// Fires the completion once. Callable from any thread; later calls are dropped.
  func settle(_ result: Result<[String: Any], Error>) {
    settlementLock.lock()
    if hasSettled {
      settlementLock.unlock()
      return
    }
    hasSettled = true
    let orphanedURL: URL?
    if case .failure = result { orphanedURL = outputURL } else { orphanedURL = nil }
    settlementLock.unlock()
    if let orphanedURL {
      try? FileManager.default.removeItem(at: orphanedURL)
    }
    completion(result)
  }

  private func buffer(_ result: Result<[String: Any], Error>, url: URL? = nil) {
    settlementLock.lock()
    defer { settlementLock.unlock() }
    guard !hasSettled, processedResult == nil else {
      if let url, hasSettled { try? FileManager.default.removeItem(at: url) }
      return
    }
    processedResult = result
    outputURL = url
  }

  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    if let error {
      buffer(.failure(error))
      return
    }

    guard let data = photo.fileDataRepresentation() else {
      buffer(.failure(NativeCameraError.photoDataUnavailable))
      return
    }

    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension("jpg")
    do {
      try data.write(to: url, options: .atomic)
      let dimensions = photo.resolvedSettings.photoDimensions
      buffer(
        .success([
          "uri": url.absoluteString,
          "width": Int(dimensions.width),
          "height": Int(dimensions.height)
        ]),
        url: url
      )
    } catch {
      try? FileManager.default.removeItem(at: url)
      buffer(.failure(error))
    }
  }

  /** Use this function to settle the buffered result and clean up once the capture ends. */
  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings,
    error: Error?
  ) {
    if let error {
      settle(.failure(error))
      return
    }
    settlementLock.lock()
    let buffered = processedResult
    settlementLock.unlock()
    settle(buffered ?? .failure(NativeCameraError.captureInterrupted))
  }
}

enum NativeCameraError: Error {
  case noCamera
  case cannotAddInput
  case cannotAddOutput
  case notReady
  case photoDataUnavailable
  /// The capture ended without producing a photo and without an error of its own.
  case captureInterrupted
  /// The session stopped while a capture was still in flight.
  case sessionStopped
}

/**
 The state this view changes on the shared `AVCaptureDevice`, as it was before
 the view touched it.

 `AVCaptureDevice` is shared per process, so every setting here outlives the
 view. Without a restore, leaving this screen left the VisionCamera path running
 under this view's format, exposure cap and low-light policy the next time the
 camera opened.
 */
private struct SavedDeviceState {
  let format: AVCaptureDevice.Format
  let photoDimensions: CMVideoDimensions
  let focusMode: AVCaptureDevice.FocusMode
  let exposureMode: AVCaptureDevice.ExposureMode
  let automaticLowLightBoost: Bool?
  let videoZoomFactor: CGFloat
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
  private var savedDeviceStates: [String: SavedDeviceState] = [:]
  private var sessionGeneration: UInt = 0
  private var rotationCoordinator: Any?
  private var previewRotationObservation: NSKeyValueObservation?
  private var captureRotationObservation: NSKeyValueObservation?

  /**
   Configuration is deferred to `applyPendingConfiguration`, which Expo calls
   once per prop batch through `OnViewDidUpdateProps`. Mount used to configure
   the session twice: once from `init` with the default position, then again
   when the `position` prop arrived. Each pass is a full
   `beginConfiguration` → device selection → input → `commitConfiguration`, and
   device selection alone walks up to four device types.

   The first flag starts true rather than being set by a prop setter, because a
   prop that arrives equal to its default does not change and so sets nothing.
   */
  private var needsSessionConfiguration = true
  private var needsPolicyUpdate = false

  var isActive = false {
    didSet { updateRunningState() }
  }

  var position = AVCaptureDevice.Position.back {
    didSet {
      guard oldValue != position else { return }
      needsSessionConfiguration = true
    }
  }

  var maxDetail = true {
    didSet {
      guard oldValue != maxDetail else { return }
      needsPolicyUpdate = true
    }
  }

  var motionPriority = true {
    didSet {
      guard oldValue != motionPriority else { return }
      needsPolicyUpdate = true
    }
  }

  var disableLowLightBoost = false {
    didSet {
      guard oldValue != disableLowLightBoost else { return }
      needsPolicyUpdate = true
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

  private var tuning: CaptureTuning {
    CaptureTuning.of(maxDetail: maxDetail, motionPriority: motionPriority)
  }

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    previewLayer.videoGravity = .resizeAspectFill
    previewLayer.session = session
    pinchRecognizer.isEnabled = pinchZoom
    addGestureRecognizer(pinchRecognizer)
  }

  /**
   Applies one batch of prop changes. Called once per prop batch, so changing
   `maxDetail`, `motionPriority` and `disableLowLightBoost` together costs one
   configuration cycle rather than three.
   */
  func applyPendingConfiguration() {
    if needsSessionConfiguration {
      needsSessionConfiguration = false
      needsPolicyUpdate = false
      reconfigure()
      return
    }
    if needsPolicyUpdate {
      needsPolicyUpdate = false
      reconfigurePolicy()
    }
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
      // Widest first: a multi-camera device can switch lenses as zoom changes,
      // which a single wide-angle device cannot.
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
    // `.photo` is the only preset that gives the photo output the device's full
    // still-image dimensions; the video presets cap it at their own resolution.
    session.sessionPreset = .photo

    if let currentInput {
      // Restore the outgoing device before dropping it, or a position flip
      // leaves the previous camera configured for this view forever.
      restoreDeviceState(for: currentInput.device)
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

      saveDeviceStateIfNeeded(for: device)
      configureDevicePolicy(device)
      configureOutput(for: device)
      session.commitConfiguration()

      let resolved = tuning
      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        self.configureOrientation(for: device)
        self.onCameraReady(["requestedCaptureTuning": resolved.telemetryName])
        self.diagnostic(
          "session_bound",
          [
            "camera_position": self.position == .front ? "front" : "back",
            "max_detail": self.maxDetail,
            "motion_priority": self.motionPriority,
            "capture_tuning": resolved.telemetryName,
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
    guard tuning.prefersHighestResolution else {
      if let original = savedDeviceStates[device.uniqueID]?.format {
        device.activeFormat = original
      }
      return
    }

    // Formats are ranked by the still-image dimensions they support, not by
    // their video dimensions, because this session only ever takes photos.
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
    // Dimensions always come from the active format: a saved value can belong
    // to another lens's format, which AVFoundation rejects at capture.
    let supportedDimensions = device.activeFormat.supportedMaxPhotoDimensions
    if tuning.prefersHighestResolution, let dimensions = supportedDimensions.max(by: {
      Int64($0.width) * Int64($0.height) < Int64($1.width) * Int64($1.height)
    }) {
      photoOutput.maxPhotoDimensions = dimensions
    } else if let dimensions = supportedDimensions.min(by: {
      Int64($0.width) * Int64($0.height) < Int64($1.width) * Int64($1.height)
    }) {
      photoOutput.maxPhotoDimensions = dimensions
    }

    photoOutput.maxPhotoQualityPrioritization = tuning.qualityPrioritization

    if #available(iOS 17.0, *) {
      // Both keep recent frames on hand so the returned photo is closer to the
      // moment of the shutter press. Each is gated on its own support flag: the
      // combination that supports them depends on the format chosen above.
      let wantsLowLag = tuning.prefersZeroShutterLag
      photoOutput.isZeroShutterLagEnabled =
        wantsLowLag && photoOutput.isZeroShutterLagSupported
      photoOutput.isFastCapturePrioritizationEnabled =
        wantsLowLag && photoOutput.isFastCapturePrioritizationSupported
    }
  }

  private func configureDevicePolicy(_ device: AVCaptureDevice) {
    do {
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }

      configureFormat(device)

      // Continuous modes rather than one-shot: the subject is an animal that
      // moves between the preview settling and the shutter press.
      if device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusMode = .continuousAutoFocus
      }
      if device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposureMode = .continuousAutoExposure
      }

      if device.isLowLightBoostSupported {
        device.automaticallyEnablesLowLightBoostWhenAvailable = true
      }

      if tuning.prefersExposureCap,
         let cap = CameraExposurePolicy.motionPreservingExposureCap(for: device) {
        device.activeMaxExposureDuration = cap
      } else {
        // `.invalid` is AVFoundation's "no cap of mine", not zero.
        device.activeMaxExposureDuration = .invalid
      }
    } catch {
      DispatchQueue.main.async { [weak self] in
        self?.onCameraError(["message": String(describing: error)])
      }
    }
  }

  private func saveDeviceStateIfNeeded(for device: AVCaptureDevice) {
    guard savedDeviceStates[device.uniqueID] == nil else { return }
    savedDeviceStates[device.uniqueID] = SavedDeviceState(
      format: device.activeFormat,
      photoDimensions: photoOutput.maxPhotoDimensions,
      focusMode: device.focusMode,
      exposureMode: device.exposureMode,
      automaticLowLightBoost: device.isLowLightBoostSupported
        ? device.automaticallyEnablesLowLightBoostWhenAvailable
        : nil,
      videoZoomFactor: device.videoZoomFactor
    )
  }

  /**
   Puts the shared device back as it was found. Must run whenever this view
   stops owning the device: a position flip, or the view leaving the window.
   */
  private func restoreDeviceState(for device: AVCaptureDevice) {
    guard let saved = savedDeviceStates.removeValue(forKey: device.uniqueID) else { return }

    do {
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }

      device.activeFormat = saved.format
      // The format may differ from the one the cap was computed under, so drop
      // the cap outright rather than restore a duration from another format.
      device.activeMaxExposureDuration = .invalid
      if device.isFocusModeSupported(saved.focusMode) {
        device.focusMode = saved.focusMode
      }
      if device.isExposureModeSupported(saved.exposureMode) {
        device.exposureMode = saved.exposureMode
      }
      if device.isLowLightBoostSupported, let boost = saved.automaticLowLightBoost {
        device.automaticallyEnablesLowLightBoostWhenAvailable = boost
      }
      device.videoZoomFactor = saved.videoZoomFactor
    } catch {
      // Nothing useful to report: the view is going away.
    }

    if saved.photoDimensions.width > 0, saved.photoDimensions.height > 0 {
      photoOutput.maxPhotoDimensions = saved.photoDimensions
    }
  }

  /**
   The teardown hook. Fabric calls this when it unmounts the component view,
   which is the point where this view stops owning the shared device.

   `OnViewDestroys` is Android-only, and `deinit` does not run while JavaScript
   still holds the ref, so neither one works here. `didMoveToWindow` is the
   wrong signal as well: it also fires on transient detaches, so it would
   restore the device and re-apply the policy over and over.

   Fabric recycles component views, so this instance may be mounted again with
   a fresh set of props. Everything that describes the old session is therefore
   cleared, and `needsSessionConfiguration` is set so the next prop batch
   configures from scratch.
   */
  public override func prepareForRecycle() {
    super.prepareForRecycle()

    previewRotationObservation = nil
    captureRotationObservation = nil
    rotationCoordinator = nil
    needsSessionConfiguration = true
    needsPolicyUpdate = false

    sessionQueue.async { [weak self] in
      guard let self else { return }
      self.settleAllPendingCaptures(with: .sessionStopped)
      if self.session.isRunning {
        self.session.stopRunning()
      }
      if let device = self.currentDevice {
        self.restoreDeviceState(for: device)
      }
      if let input = self.currentInput {
        self.session.removeInput(input)
      }
      self.currentInput = nil
      self.currentDevice = nil
    }
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
        // Nothing to start until an input exists; `configureSession` calls back
        // here once it has one.
        guard self.currentDevice != nil, !self.session.isRunning else { return }
        self.session.startRunning()
      } else if self.session.isRunning {
        // Stopping cancels any capture in flight, and AVFoundation may not
        // deliver a callback for it. Settle here so the shutter re-enables.
        self.settleAllPendingCaptures(with: .sessionStopped)
        self.session.stopRunning()
        self.diagnostic("session_unbound")
      }
    }
  }

  /// Must be called on `sessionQueue`, which owns `captureDelegates`.
  private func settleAllPendingCaptures(with error: NativeCameraError) {
    let pending = captureDelegates.values
    captureDelegates.removeAll()
    for delegate in pending {
      delegate.settle(.failure(error))
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
      settings.photoQualityPrioritization = self.tuning.qualityPrioritization

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
    // Backstop only. `prepareForRecycle` is what restores the device in
    // practice; this runs whenever the last reference happens to drop.
    if let device = currentDevice {
      restoreDeviceState(for: device)
    }
  }
}
