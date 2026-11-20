---
topic: camera-capture-priority
status: active
last_reviewed: 2026-11-19
governs:
  - src/features/settings/screens/settings/index.tsx
  - src/features/settings/config/photoToggles.ts
  - src/features/settings/config/capturePriority.ts
  - src/features/settings/copy/settingsCopy.ts
  - src/features/settings/hooks/useSettingsStore.ts
  - src/features/camera-control/hooks/useNativeCameraCapture.tsx
  - src/features/camera-control/hooks/useCameraCapture.tsx
  - modules/native-identification-camera/android/src/main/java/expo/modules/nativeidentificationcamera/NativeIdentificationCameraView.kt
  - modules/native-identification-camera/ios/NativeIdentificationCameraView.swift
derives_from: ['#460']
---

# Camera Capture Priority

## Context

- Settings offers experimental controls for native camera capture.
- Capture Priority (`CapturePriority`) expresses the same speed-versus-quality choice as iOS.

## Design Specifications

- Use one three-position Capture priority control with the exact labels **Speed**, **Balanced**, and **Quality**, in that order.
- Show it when experimental camera controls are available. Native camera capture is always on, so Settings has no Native Camera Capture or Improved Camera Capture toggle.
- Keep Speed, Balanced and Quality on one row, sharing the width equally.
- Replace the separate Maximum Detail and Motion Priority switches with this control.
- Hold one selected value. Selecting the current value does not clear it.
- A selection applies and saves at once. Settings has no Save or Discard buttons.
- Low-light boost is enabled automatically where the device supports it. Settings has no low-light-boost toggle.
- Keep the control readable and operable with enlarged text and in both themes.

## Reason

- One mutually exclusive choice communicates the capture tradeoff more clearly than two independent switches.
- The exact labels match iOS terminology and give the same choice a consistent name across platforms.
