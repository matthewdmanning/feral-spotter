# Startup profile: FeralSpotter on Pixel 7 (release build)

Date: 2026-10-23. Branch: `perf-build-profile`. Build: release, installed 13:18,
profileable (prebuilt with `PROFILEABLE_BUILD=1`; without it a build is not
profileable and the camera trace code stays off). Compile state: `speed-profile`.

## Method

- 10 Perfetto traces: force-stop, cold launch, Take Photos, 3 captures. Taps
  use fixed coordinates; there are no `uiautomator` dumps. The page cache was
  not dropped (process-cold start, warm page cache).
- 1 `simpleperf` cold-start sample, 2000 Hz, 4 s. The profiler adds load:
  that start took 1272 ms. Use it for proportions only.
- Bundle attribution from `npx expo export --platform android --source-maps`.
- Caveat: the phone reported `Thermal Status: 3` for all runs, but every
  sensor read normal (skin 34 °C). The absolute numbers may be high.

## Headline numbers (10 runs)

| Metric                                | Median  | Min–max |
| ------------------------------------- | ------- | ------- |
| TTID (first frame of the activity)    | 788 ms  | 622–965 |
| Splash removed, home visible (iter 9) | ~950 ms | —       |
| Tap Take Photos → first preview frame | 416 ms  | 394–460 |

TTID counts only to the first frame of the splash. The user sees the home
screen about 180 ms later.

## Critical path (iter 9, TTID 769 ms)

| t (ms)  | Thread | Work                                                                                                    |
| ------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 0–61    | —      | Process start                                                                                           |
| 67–189  | main   | `bindApplication` 121 ms: `.so` loads ~80 ms (`react_featureflagsjni` 27, `appmodules` 26, APK open 24) |
| 189–241 | main   | `activityStart` 34, `activityResume` 18                                                                 |
| 223–291 | pool-7 | `ReactInstance.initialize` 68 ms (TurboModules 29, Fabric 27)                                           |
| 291–750 | JS     | **~450 ms running**: bundle evaluation, React render, native module and view-manager setup              |
| 686     | JS     | `SplashScreen.hideAsync` called (fonts already loaded)                                                  |
| 750–870 | main   | First content mount; `doFrame` work 210 ms in this 250 ms bucket                                        |
| 926–955 | system | Splash view handed over and removed; home visible                                                       |

## What the JS thread does (simpleperf, share of JS-thread samples)

| Share | What                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| 38%   | Hermes VM: interpreting the bundle. JS function names are not available (stripped VM)                                          |
| 29%   | libc: `memset` 8%, malloc/free ~9%. Mostly Hermes heap growth and JSI class creation                                           |
| 19.5% | `ReactInstance.getConstants`: view-manager constants for every registered view manager (`makeNativeMap` 13.5%, eager map 7.4%) |
| 6.9%  | `ExpoModulesPackage.createViewManagers` → `FabricComponentsRegistry.<init>` (props parser for each Expo view)                  |
| 3.1%  | `NativeModulesProxy.getConstants` (Expo)                                                                                       |
| 2.7%  | Reanimated + Worklets install                                                                                                  |
| 1.5%  | Firebase Auth module and `FirebaseAuth.<init>`                                                                                 |

## Bundle (4.2 MB minified, Hermes bytecode in the APK, 4.9 MB)

| Package                              | Size   | Share | Needed on the home screen?                                              |
| ------------------------------------ | ------ | ----- | ----------------------------------------------------------------------- |
| react-native-reanimated              | 693 KB | 17.6% | Camera shutter animation; not on home                                   |
| react-native                         | 690 KB | 17.5% | Yes (already lazy by default in Expo)                                   |
| expo-router                          | 451 KB | 11.4% | Yes                                                                     |
| @posthog/core + posthog-react-native | 370 KB | 9.4%  | Only after analytics consent; imported statically in `AppProviders.tsx` |
| react-native-gesture-handler         | 106 KB | 2.7%  | Root view                                                               |
| react-native-svg                     | 104 KB | 2.6%  | Icons                                                                   |
| @shopify/flash-list                  | 82 KB  | 2.1%  | Camera thumbnail strip, lists                                           |
| react-native-reanimated-carousel     | 79 KB  | 2.0%  | Annotate screen only                                                    |
| @expo/ui                             | 61 KB  | 1.5%  | Not imported by `src/`; comes in transitively                           |
| react-native-vision-camera           | 34 KB  | 0.9%  | Legacy camera path only                                                 |
| react-native-fbsdk-next              | 16 KB  | 0.4%  | Facebook sign-in, gated off until 1.0.0                                 |

## Configuration facts

- Metro: `inlineRequires: false`, `experimentalImportSupport: true` (Expo
  default, `@expo/metro-config` `ExpoMetroConfig.js:343-347`). No
  `metro.config.js` in the repo. Package imports evaluate at startup.
- `babel-preset-expo` has a `lazyImports` option. It is not set
  (`babel.config.js`). Only `react-native` and its lazy set load lazily.
- expo-router on native loads every route module at startup, so every screen's
  imports (camera, annotate, location picker with expo-maps) evaluate before
  the home screen. Unverified: I did not confirm this in the expo-router docs.
- Autolinked native packages: 21 React Native packages plus the Expo modules.
  They include FBSDK (gated off), VisionCamera (legacy path), AsyncStorage and
  MMKV (two key-value stores), and MaskedView.
- Fonts: 5 Nunito fonts load at runtime through `useFonts`
  (`src/app/_layout.tsx:34`). They are done before `hideAsync` at 686 ms, so
  they are not on the critical path in this build.

## Scope (decided 2026-10-23)

Startup speed matters only for a returning user: permissions granted, and the
analytics choice made. Optimize that path only. First-run screens (intro,
consent, sign-in, permission gates) are out of scope. A user who accepted
analytics needs PostHog at startup, so a deferred PostHog import helps only a
user who declined analytics.

## Opportunities, ranked by expected gain

1. **Defer JS module evaluation.** Most of the ~450 ms of JS thread time comes
   from evaluating modules that the home screen does not need: Reanimated,
   PostHog, the carousel, VisionCamera, and the location picker. Levers:
   `lazyImports: true` in `babel-preset-expo`, or Metro `inlineRequires`.
   Another lever is a dynamic `import()` of PostHog after consent. The gain
   is not measured.
2. **Reduce view-manager setup (~27% of JS-thread samples).** It grows with
   each native view library that is registered. Removing unused native
   packages (FBSDK while gated, VisionCamera if the legacy path is retired)
   cuts it.
3. **Native library loads in `bindApplication` (~80 ms).** These are fixed
   costs of React Native and Expo. A Baseline Profile and the `speed-profile`
   state help only the Java/Kotlin side.

## Screen transitions (returning-user flow)

Method: for each step, the target was found in a screen dump _before_ the
trace started. Then a 6 s trace recorded one fixed-coordinate tap. One run
per step. The draft held **36 photos** (left over from the profiling runs),
which makes the annotate numbers a heavy case.

| Step                          | Response | Settle  | Janky frames (worst) | JS running  |
| ----------------------------- | -------- | ------- | -------------------- | ----------- |
| Tab: Reports                  | 57 ms    | 870 ms  | 1 (26 ms)            | 86 ms       |
| Tab: Settings                 | 30 ms    | 893 ms  | 2 (35 ms)            | 91 ms       |
| Tab: Home                     | 81 ms    | 919 ms  | 1 (17 ms)            | 59 ms       |
| Home → camera                 | 34 ms    | 1285 ms | 0                    | 143 ms      |
| Capture                       | 54 ms    | 453 ms  | 1 (19 ms)            | 84 ms       |
| Camera Done → annotate        | 136 ms   | 2358 ms | **13 (184 ms)**      | **1190 ms** |
| Annotate: Confirm             | 91 ms    | 2230 ms | **63 (141 ms)**      | **1383 ms** |
| Annotate: Not in this photo   | 57 ms    | 424 ms  | **8 (134 ms)**       | 326 ms      |
| Annotate: Previous            | 65 ms    | 387 ms  | **12 (129 ms)**      | 405 ms      |
| Done With This Cat → Cat Form | 48 ms    | 2222 ms | **20 (159 ms)**      | 208 ms      |
| Cat Form: chip tap            | 32–58 ms | 170 ms  | 0                    | 21–33 ms    |
| Cat Form: scroll (3 flings)   | 37 ms    | —       | 0                    | 40 ms       |
| Cat Form: Save → dialog       | 48 ms    | 223 ms  | 1 (41 ms)            | 60 ms       |
| Save anyway → Submission      | 122 ms   | 551 ms  | 1 (48 ms)            | 82 ms       |
| Submission: Edit cat          | 24 ms    | 1983 ms | 0                    | 158 ms      |
| Cat Form back                 | 28 ms    | 526 ms  | 0                    | 74 ms       |
| Take More Photos → camera     | 42 ms    | 583 ms  | 0                    | 144 ms      |
| Close camera                  | 49 ms    | 514 ms  | 0                    | 41 ms       |

Not covered: the location picker. It opens only from the low-accuracy
warning icon, and this draft had a good fix. `Add a Cat` caused no screen
change during the 6 s trace; the cause is not checked.

### Finding 1: the annotate carousel renders every photo

- `src/screens/submission/annotate/index.tsx:118` renders
  `react-native-reanimated-carousel` (4.0.3) with no `windowSize`.
- With no `windowSize`, the library renders every item
  (`useVisibleRanges.tsx:23` uses `total`; `ItemRenderer.tsx:76-80` skips
  only items outside the range).
- Effect with 36 photos: each entry to annotate and each `Confirm` runs 72
  Glide `decodeBitmap` calls (avg 43 ms, total ~3.1 s on the decode thread),
  plus a 878×1560 texture upload per photo. The JS thread runs 1.2–1.4 s.
  Up to 63 janky frames, worst 184 ms.
- Each Next/Previous step re-renders all items too: 8–12 janky frames, worst
  about 130 ms. `handleConfirmBox` and `handleNotInPhoto` change on every
  index change, and `renderItem` is an inline closure, so every mounted item
  re-renders.
- **Fix that keeps the behavior:** pass `windowSize={3}` (current photo plus
  one on each side). The carousel already has `enabled={false}` and moves
  only by `scrollTo` to the next or previous index, so the neighbors stay
  mounted for the scroll animation. Cost grows with 3 photos instead of N.
  Check with a test drive on a draft with many photos.

### Finding 2: a frame loop runs on every screen, even when idle

- Every trace shows the main thread running about 80 ms per second with no
  input. RenderThread reports `NothingToDraw`.
- `simpleperf` on the idle app (4 s): 70% of the app's samples are
  Choreographer frames. Worklets `AnimationFrameQueue.executeQueue` (24.6%)
  calls a worklet each frame, and Fabric `DispatchUIFrameCallback` (31.9%)
  runs each frame.
- Not the app's `BottomButtonColumn` (finite `withTiming`). The only
  `useAnimatedReaction` is in `useBoundingBoxFrame.ts:184` (annotate only),
  but the loop also runs on the home screen right after launch. The source
  is not identified. Next step: profile an idle screen with one library at
  a time disabled, or capture the Hermes UI-runtime profile (issue #410).
- Effect: battery and CPU while the app is open. It competes with the JS
  and render work in every transition.

### Finding 3: smaller items

- Home → camera: `createCaptureSession` took 359 ms on the first open after
  launch, 120 ms on a later open. This is the camera driver.
- Edit cat: `Bitmap#prepareToDraw 1181x2100` on RenderThread (14 ms) for the
  inset crop bubble. A smaller decode size would cut it.

## Gaps in this data

- **No JS function names.** The release Hermes VM is stripped. A Hermes
  sampling profile is needed to name the JS modules and functions in the
  450 ms. That needs an instrumented or profiling build.
- **Thermal status 3** during the runs.
- **One `simpleperf` sample run.**

## Files (scratchpad)

`C:\Users\mattm\AppData\Local\Temp\claude\C--GitHub-feral-spotter\faf8642e-adda-4953-af09-1a3d0e53b597\scratchpad\`

- `runs/iter_1..10.perfetto-trace`: traces
- `aggregate.py`, `breakdown.py`, `timeline.py`: trace queries
- `bundle_by_package.py`, `export/`: bundle attribution
- `screens/*.perfetto-trace`, `screens.py`, `trace_tap.sh`: screen transitions
- On the phone: `/data/local/tmp/startup.perf.data`, `/data/local/tmp/children.txt`
