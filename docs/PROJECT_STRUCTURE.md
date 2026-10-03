# Project Structure

## Directory Layout

```
src/
├── app/          # Expo Router routes (thin re-exports only)
├── screens/      # Screen-level components and state
├── components/   # Atomic Design: atoms → molecules → organisms
├── hooks/        # Zustand stores and feature hooks
├── lib/          # Auth, cache, analytics
├── utils/        # Pure functions
└── config/       # Constants and feature flags
```

Dependency direction is strictly one-way: `app/` → `screens/` → `hooks/components/lib/` → `utils/config/`. No upward imports.

## Native modules

Expo native modules live outside `src/`, one directory per module:

```
modules/
├── native-identification-camera/   # the camera session: CameraX and AVFoundation
│   ├── src/                        # the JavaScript half
│   │   ├── types.ts                # THE CONTRACT — props, events, ref methods
│   │   └── NativeIdentificationCameraView.tsx
│   ├── android/                    # Kotlin: ExpoView + CameraX
│   ├── ios/                        # Swift: ExpoView + AVFoundation
│   ├── index.ts                    # public surface, re-exports types
│   └── expo-module.config.json
└── ios-camera-optimizer/           # iOS-only device tuning, used by the legacy path
```

`src/` may import from `modules/`; `modules/` never imports from `src/`. The
same one-way rule applies.

`types.ts` is the camera seam's contract and both platforms implement it. Adding
a prop, an event or a ref method there obliges Kotlin and Swift equally, so keep
it narrow: platform tuning belongs inside each platform's own files, not in the
contract. Android's tuning table is `android/.../CaptureTuning.kt`; the iOS
equivalents are `ios/CaptureTuning.swift` and `ios/CameraExposurePolicy.swift`.

## What is verified where

Kotlin and Swift are not covered by the JavaScript checks. `npx tsc`, `npx
eslint` and `npx jest` say nothing about either. Kotlin has a local compile
(`cd android && ./gradlew :native-identification-camera:compileDebugKotlin`);
Swift has no compile check at all on the current plan, because it needs a macOS
runner. Report a Swift change as "needs test drive", never as verified.
