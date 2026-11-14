# iOS camera: zoom, resolution, image quality

Goal: maximum device resolution, most of the scene kept. Preview quality is irrelevant.
Status: research notes, nothing run on a device. Uncommitted reference file.

Tags: **Apple** = Apple docs read through Context7. **Web** = web-search summary; the linked page was not opened, so treat as commentary. **Unverified** = general knowledge, no source this session.

## 1. Zoom mechanics

| Claim                                                                                                                  | Tag        | Source                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zoom crops around the sensor center.                                                                                   | Apple      | [videoZoomFactorUpscaleThreshold](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videozoomfactorupscalethreshold) |
| Below the threshold the crop is at least output size, so no upscale. Above it the crop is scaled up and quality drops. | Apple      | same                                                                                                                                             |
| Depth delivery locks the zoom factor of the wide and telephoto cameras.                                                | Apple      | [Capturing photos with depth](https://developer.apple.com/documentation/avfoundation/capturing-photos-with-depth)                                |
| With depth delivery on, the upscale threshold falls to 1.0.                                                            | Web        | [AVCaptureDevice.Format](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format.md)                                       |
| A zoom above `videoMaxZoomFactor` throws. `maxAvailableVideoZoomFactor` clamps.                                        | Web        | [maxAvailableVideoZoomFactor](https://developer.apple.com/documentation/avfoundation/avcapturedevice/maxavailablevideozoomfactor.md)             |
| `secondaryNativeResolutionZoomFactors` lists zoom factors that enter a secondary native-resolution mode.               | Web        | [AVCaptureDevice.Format](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format.md)                                       |
| Zoom cannot be applied to the preview alone on iOS; the photo follows `videoZoomFactor`.                               | Unverified | none                                                                                                                                             |

## 2. Virtual devices and lens switching

| Claim                                                                                             | Tag   | Source                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dual-camera virtual device is built from a wide and a telephoto camera, each with its own port. | Apple | [ports(for:sourceDeviceType:...)](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/ports%28for%3Asourcedevicetype%3Asourcedeviceposition%3A%29) |
| `virtualDeviceSwitchOverVideoZoomFactors` gives the factors where the next lens takes over.       | Apple | [virtualDeviceSwitchOverVideoZoomFactors](https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors)                  |
| At each factor one lens's field of view equals the next lens's full field of view.                | Apple | same                                                                                                                                                                       |
| Factor count = constituent device count minus one. Empty for non-virtual devices.                 | Apple | same                                                                                                                                                                       |
| A photo can be delivered per lens through `virtualDeviceConstituentPhotoDeliveryEnabledDevices`.  | Apple | [property page](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/virtualdeviceconstituentphotodeliveryenableddevices)                         |
| Between switch-over points the active lens is zoomed digitally.                                   | Web   | [Digital zoom 2.0 on smartphones](https://nextpit.com/digital-zoom-2-0-smartphones-200-megapixels-resolution)                                                              |

Meaning: only the zoom factors at and just above a switch-over point are optical.

## 3. Real-world: optical versus crop

| Claim                                                                                 | Tag        | Source                                                                                                              |
| ------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| "2x" on 48 MP main-camera models is a 12 MP center crop of the main sensor.           | Web        | [PhoneArena: 2X zoom on iPhone 14 Pro](https://www.phonearena.com/news/2X-zoom-on-iPhone-14-Pro-explained_id143704) |
| iPhone 15 Pro 28 mm and 35 mm modes are digital crops.                                | Web        | [GSMArena experiment](https://m.gsmarena.com/newscomm-60014.php)                                                    |
| iPhone 17 Pro: 4x telephoto feeds a 48 MP sensor. 8x is a 2x crop giving 12 MP.       | Web        | [TidBITS thread](https://talk.tidbits.com/t/interesting-facts-about-optical-zoom-on-the-iphone-17-pro/31900)        |
| The 48 MP sensor sits behind a 12 MP color filter, so real detail is far below 48 MP. | Web        | [Digital zoom 2.0 on smartphones](https://nextpit.com/digital-zoom-2-0-smartphones-200-megapixels-resolution)       |
| Telephoto sensors may have fewer pixels or less light than the main camera.           | Unverified | none                                                                                                                |

## 4. Our code (read only)

File: `modules/native-identification-camera/ios/NativeIdentificationCameraView.swift`

| Behavior                                                                             | Location                    |
| ------------------------------------------------------------------------------------ | --------------------------- |
| Back camera search order: triple, dual-wide, dual, wide.                             | device selection, ~line 159 |
| Picks the highest-pixel `activeFormat` once.                                         | `configureFormat`           |
| Sets `photoOutput.maxPhotoDimensions` to the largest for that format.                | `configureOutput`           |
| Sets `settings.maxPhotoDimensions` per shot.                                         | capture, ~line 453          |
| Pinch sets `videoZoomFactor`, clamped only by min and max available. No upscale cap. | `handlePinch`, ~line 417    |
| Pinch default is off.                                                                | comment, ~line 118          |

Gap: format and dimensions are not re-checked after a lens switch.

## 5. Other quality factors (not researched)

- `maxPhotoQualityPrioritization` (speed, balanced, quality): [Apple example](https://developer.apple.com/documentation/avfoundation/capturing-depth-using-the-lidar-camera). Effect not detailed.
- Stabilization: [Apple example](https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos). Zoom interaction not checked.
- Motion priority, low-light boost, exposure cap: in our code. Zoom interaction not checked.

## 6. Open questions

- Switch-over factors and upscale threshold on the target iPhones?
- Saved photo pixel size at 1x, each switch-over, and the cap?
- Does `maxPhotoDimensions` shrink after a lens switch?
- Cap at the upscale threshold, or at the first switch-over?

## 7. Doc conflicts in repo

- `docs/agents/ui-ux/current-state/camera-pinch-zoom.md` says pinch is on by default.
- `docs/test-drives/run-notes/2026-09-28-feat-android-camera-setup.md` and the Swift comment say off.
