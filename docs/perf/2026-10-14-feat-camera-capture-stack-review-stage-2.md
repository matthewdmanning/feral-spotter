Stage 2 — Performance

#: 1
Severity: 🟠 High
File:line: useCameraCapture.tsx:232-238
Issue: Burst cadence is gated on a media-library write. await Asset.create(...) sits inside the do...while burst loop, so every frame waits for a
gallery write before the next capture starts. With keep_photos_on_device on — the default (:71-73 treats anything but false as true) — burst rate
is bounded by MediaLibrary I/O, not by the camera. Collect the URIs and write them after the loop, or fire and forget with the errors collected.
────────────────────────────────────────
#: 2
Severity: 🟠 High
File:line: Kotlin :263, Swift :29, legacy via saveToTemporaryFileAsync
Issue: Temp files are never deleted. Every capture writes a JPEG to the cache directory and nothing removes it after upload — no deleteAsync or
unlink anywhere under src/lib/upload/. Growth is unbounded across sessions on all three paths; the OS reclaims it only under storage pressure.
Burst multiplies it per sighting.
────────────────────────────────────────
#: 3
Severity: 🟠 High
File:line: Kotlin :79, 86, 93 → :134-140
Issue: Android tears down and rebuilds the whole camera seach setter posts its own unbind + bind. Two settings changed
together means two full session teardowns, each with a blaonCameraReady. Expo's OnViewDidUpdateProps runs once after
a prop batch and is the correct coalescing point; the module uses neither it nor a pending flag.
────────────────────────────────────────
#: 4
Severity: 🟡 Medium
File:line: useCameraCapture.tsx:196, 325-336, 340-344
Issue: Burst re-renders the thumbnail list on every frame.[...prev, submission]) runs inside the burst loop;renderItem
depends on capturedPhotos.length so it is recreated each tct fires per frame. A full FlashList re-render plus an
animated scroll lands between every two captures, while the camera is still working.
────────────────────────────────────────
#: 5
Severity: 🟡 Medium
File:line: useCameraCapture.tsx:225
Issue: Unbounded upload concurrency during burst. uploadNeaited, so a long burst starts one upload per frame with no
cap or queue. On a slow connection these compete with the capture path and with each other.
────────────────────────────────────────
#: 6
Severity: 🟡 Medium
File:line: Swift :125 + :88-91
Issue: iOS configures the session twice on mount. init calault .back position, then the position prop arrives and
didSet calls reconfigure() again. Each pass is a full beginConfiguration → device selection → AVCaptureDeviceInput → commit, and device selection
loops AVCaptureDevice.default over up to four device types
────────────────────────────────────────
#: 7
Severity: 🟡 Medium
File:line: Swift :134-142
Issue: iOS reconfigures per prop, same shape as finding 3. reconfigurePolicy runs a separate beginConfiguration/commitConfiguration cycle for each
of maxDetail, motionPriority, and disableLowLightBoost. Chind, but three cycles where one would do.
────────────────────────────────────────
#: 8
Severity: 🟢 Low
File:line: useCameraCapture.tsx:282-297, useNativeCameraCa
Issue: handleTakePhoto lists isTakingPhoto — which it sets itself — in its dependency array, so the callback is recreated twice per capture and
re-renders the shutter. Same for isCameraReady in the natiard.
────────────────────────────────────────
#: 9
Severity: 🟢 Low
File:line: Swift :38
Issue: ISO8601DateFormatter() is allocated inside the capture callback, once per photo. Formatter construction is expensive relative to everything
else in that block. Hoist it to a static let.
────────────────────────────────────────
#: 10
Severity: 🟢 Low
File:line: Kotlin :178-188
Issue: Two SessionConfig objects are built per bind — one as a throwaway probe for getSupportedFrameRateRanges, one for real.
────────────────────────────────────────
#: 11
Severity: 🟢 Low
File:line: src/screens/camera/index.tsx:11 Issue: isNativeIdentificationCameraAvailable() runs on evethe component subscribes to the settings store, so itre-runs on any settings change. Hoist to module scope.
──────────────────────────────────────── #: 12
Severity: 🟢 Low File:line: modules/native-identification-camera/src/Native19-34
Issue: useMemo(getNativeView, []) wraps a function that already caches in a module-level cachedView. One of the two is redundant.  
What is already right: photo.dispose() in a finally block (useCameraCapture.tsx:189-191) correctly releases the VisionCamera buffer on the error path. Telemetry is gated behind camera_performance_checks gallerySavePermission.check() is hoisted outside the burstloop.

Stage 2 verdict: findings 1 and 4 both sit in the burst hot path and compound — the list re-renders while the loop waits on a gallery write.
Finding 2 is the one that degrades the device over time ra
