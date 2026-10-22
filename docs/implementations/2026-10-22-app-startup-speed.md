# App start-up and camera-open speed

**Scope:** feature (performance)
**Issues/spec:** user request 2026-10-22, "the app loads slowly, so the first picture takes too long". Follow-up: #406 (switch to phosphor-react-native).
**Date:** 2026-10-22
**Branch/PR:** `ccr-aa3fa582-dzrsj5`

## Scope

**In scope:**

- [x] Expo tree shaking and Metro inline requires for production bundles.
- [x] Start CameraX early, while Home is idle (Android).
- [x] Limit CameraX to the back camera (Android), and remove the flip control.
- [x] Read the camera permission synchronously on the native Capture backend.
- [x] Evaluate the Camera screen's JavaScript while Home is idle.
- [x] iOS: use one physical camera, deferred start, responsive capture.

**Out of scope / not addressed:**

- `babel-preset-expo` `lazyImports: true`. Proposed, then dropped: it does nothing in SDK 56 (see Graveyard).
- Replacing `lucide-react-native`. Tracked in #406.
- A start-up measurement. Proposed as step 0, not confirmed for this branch.

## Intent

**Purpose:** cut the time from a cold app start to the first photograph. Two
paths count: app start to Home, and the tap on Take Photos to a ready shutter.

## Design decisions and reasoning

### Tree shaking with inline requires, production only

- **Decision:** `metro.config.js` sets `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH` and
  `EXPO_UNSTABLE_TREE_SHAKING`, and turns on `inlineRequires` when `dev` is
  false.
- **Reason:** the app imports Lucide icons from the package barrel. The barrel
  pulls every icon into the bundle and runs each icon module at start. Expo's
  SDK 56 tree-shaking guide pairs inline requires with tree shaking and
  advises against inline requires alone.
- **Affected journey/state:** cold start, release builds only. Expo applies
  both flags in production mode only, so development bundles do not change.
- **Why in the config file:** `.env` is gitignored. Expo CLI reads both flags
  after it loads `metro.config.js`. Confirmed: `expo export` and `expo
export:embed` (the path a Gradle release build takes) both log "Experimental
  tree shaking is enabled". An explicit `0` in the environment still turns the
  flags off.

### CameraX limited to the back camera, flip control removed

- **Decision:** `NativeIdentificationCameraPackage.kt` registers an
  `ApplicationLifecycleListener`. In `Application.onCreate` it calls
  `ProcessCameraProvider.configureInstance` with
  `setAvailableCamerasLimiter(CameraSelector.DEFAULT_BACK_CAMERA)`.
- **Reason:** the CameraX configuration guide says the first `getInstance`
  enumerates every camera, at a non-trivial cost per camera. The front camera
  has too low a resolution for identification photographs and has zero product
  priority (user decision, 2026-10-22).
- **Consequence:** CameraX hides the front camera, and binding it throws. So
  both Capture backends lose the flip control. The limit is process-wide, so
  the `visioncamera` backend sees it too. `CameraShutterRow` keeps an empty
  left slot, so the shutter stays centred. The Camera seam contract still
  carries `position`; JavaScript now always sends `back`.

### Early CameraX start and Camera screen evaluation from Home

- **Decision:** Home calls `scheduleCameraWarmUp()` once, after mount. On idle
  it calls the native `prewarm` function (Android `ProcessCameraProvider.getInstance`)
  and runs `import('@/src/screens/camera')`.
- **Reason:** Expo Router loads a route module only on its first visit (the
  route's `getComponent`). Without the warm-up, the Camera screen's whole
  module graph runs between the tap and the first frame. The same holds for
  CameraX enumeration, which the native view starts in its `init`.
- **Why not `router.prefetch('/camera')`:** a prefetch renders the screen
  offscreen. That runs its mount effects, which log `CAMERA_OPENED` and start
  the Live fix before the user opens the camera.

### Synchronous camera permission on the native Capture backend

- **Decision:** `NativeCameraScreen` uses VisionCamera's `useCameraPermission`
  instead of `expo-image-picker`'s `useCameraPermissions`.
- **Reason:** the Expo permission hook starts at `null` and resolves through a
  native call (`expo-modules-core` `PermissionsHook.ts`). So the screen first
  rendered the permission gate, then mounted the camera one round trip later,
  even with permission granted. VisionCamera reads the status synchronously
  on the first render. The `visioncamera` backend already used this hook.

### iOS: one physical camera, deferred start, responsive capture

- **Decision:** the back camera now uses `.builtInWideAngleCamera` only. On
  iOS 26 the session uses automatic deferred start, with the preview layer not
  deferred and the photo output deferred. With motion priority, the photo
  output turns on responsive capture where it is supported.
- **Reason:** VisionCamera's performance guide says a camera with fewer
  physical devices starts faster. WWDC26 session 303 says deferring all
  outputs except the preview makes the preview appear sooner, but the first
  capture then waits for the photo output, and responsive capture is the fix.
- **Tradeoff:** iOS no longer switches lenses on its own, e.g. to macro for a
  close-up.
- **Compile guard:** the deferred-start symbols are under
  `#if compiler(>=6.2)` and `#available(iOS 26.0, *)`, so an older Xcode still
  builds.

## What shipped

- `metro.config.js` (new): tree shaking and production inline requires.
- `modules/native-identification-camera/android/.../NativeIdentificationCameraPackage.kt`
  (new): back-camera limit at application start.
- `NativeIdentificationCameraModule.kt`: `prewarm` function.
- `modules/native-identification-camera/index.ts`: `prewarmCamera()`.
- `NativeIdentificationCameraView.swift`: device choice, deferred start,
  responsive capture.
- `src/screens/home/cameraWarmUp.ts` (new) and `src/screens/home/index.tsx`:
  the idle warm-up.
- `src/screens/camera/NativeCameraScreen.tsx`: synchronous permission.
- Flip control removed from `CameraChrome.tsx`, both camera screens,
  `useCapturedPhotoWorkflow`, `useCameraCapture`, `useNativeCameraCapture`.

## Measurements

Android release export (`npx expo export --platform android --source-maps`):

| Bundle                        | Hermes bytecode | Modules | Lucide modules |
| ----------------------------- | --------------- | ------- | -------------- |
| Before                        | 6.2 MB          | 4,293   | 1,752          |
| After (tree shaking + inline) | 4.6 MB          | 2,353   | 27             |

`expo export:embed` (release path): 2,379 modules after.

These figures are bundle size and module count only, not time. No device
timing was taken on this branch.

## Tests

| Test file                                                                 | What it verifies                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/hooks/__tests__/useCameraCapture.controls.model.test.ts`             | Flip model removed: its branch is unreachable (testing.md). Flash cycle model kept. |
| `src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx` | Unchanged behaviour; stale flip fields removed from the fixtures.                   |

**Not tested:**

- No new test. The warm-up is a native call plus a module import, and Jest has
  neither. `jest.setup.js` stubs `scheduleCameraWarmUp` for every suite.

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`
- [x] Unit/model tests: `npx jest` (76 suites, 349 tests)
- [x] Lint: `npm run lint` (0 errors; warnings equal to `main`)
- [x] Formatting: `npx prettier --check` on changed files
- [x] Bundle: `npx expo export --platform android` and `npx expo export:embed --platform android --dev false`

**Unverified — needs test drive:**

- Kotlin: not compiled. This container has no Android SDK, and Google's Maven
  host is blocked. The CameraX calls were checked against the androidx-main
  API files (`camera-lifecycle`, `camera-core`, `camera-camera2`), not the
  resolved artifact. Gradle resolves CameraX to 1.7.0-alpha01, because
  VisionCamera asks for it.
- Swift: not compiled (needs macOS).
- No device run on either platform. Inline requires can reorder import side
  effects, so a full pass of `docs/qa_checklist.md` on a release build is
  needed.
- No timing data. Without it, no gain in seconds is claimed.

## Graveyard: pivots and corrections

### `lazyImports: true` does nothing in SDK 56

- **Finding:** `@expo/metro-config` defaults `experimentalImportSupport` to
  `true`. That sets `disableImportExportTransform` in `babel-preset-expo`, and
  the Babel `lazy` option then never runs.
- **Impact:** idea 3 was confirmed by the user, then dropped as a no-op.
- **Resolution:** not added. Inline requires give the deferred evaluation in
  production.

### Deferred start alone does not speed up the first capture

- **Finding:** WWDC26 303: "Preview starts much sooner, but the time to the
  first capture stays the same."
- **Resolution:** responsive capture added with it.

## Follow-ups and known limitations

- [ ] #406: switch to `phosphor-react-native` with per-icon imports.
- [ ] Measure cold start (`adb shell am start -W`) and tap-to-ready before
      and after, on a release build.
- [ ] The native camera-ready timer starts after the screen mounts, so it
      misses navigation, module load and the permission wait.
- The Camera seam `position` prop and the Kotlin/Swift front-camera paths
  stay in place. They are now unreachable from JavaScript.
