---
topic: camera-pinch-zoom
status: active
last_reviewed: 2026-10-24
governs:
  - modules/native-identification-camera/android/src/main/java/expo/modules/nativeidentificationcamera/NativeIdentificationCameraView.kt
  - src/features/settings/config/photoToggles.ts
  - src/features/settings/hooks/useSettingsStore.ts
derives_from: []
---

# Camera Pinch Zoom Design Decision

## Context

- The camera preview is hard to read at the 10 to 20 m range where feral cats are photographed.
- Android CameraX zoom crops every bound use case. A sensor zoom would crop the saved photo.

## Design Specifications

- Pinch zoom is on by default and shown in Settings in every build. A user can turn it off.
- On Android, pinch zoom magnifies the preview only. The sensor stays at 1x, so the saved photo is full field and full resolution.
- The zoom range is 1x to 5x. It resets to 1x when the camera closes or the camera position changes.
- Two fingers scale and pan about the fingers. One finger pans when zoomed. The preview never shows an empty border.
- While zoomed, a small map of the whole preview sits at the left edge, mid-height. A box on it marks the part on screen.
- A tap on a zoomed preview focuses what is under the finger. A subject region from the localizer is already in preview space and is not remapped.
- iOS still zooms the camera, so an iOS photo is cropped. This differs from Android. See the implementation note.

## Reason

- Identification needs the full-field, full-resolution photo. The later crop around the cat is done after capture.
- The zoom is a viewing aid. It must not change what is saved.
- The cost is a softer zoomed preview: it only has the detail of the preview stream.
