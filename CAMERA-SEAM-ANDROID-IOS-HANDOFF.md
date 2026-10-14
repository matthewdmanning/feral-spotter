# Camera seam review — Android and iOS handoff

Date: 2026-09-28 (updated after the first physical-device drive)
Author: agent session `session_01NjWAoqUM3wWb4FAFU2FrJ3`
Status: Android compiled, driven on a Pixel 7, and working. iOS written but
never compiled and never driven.

## 1. Where the work came from

Three reviews on `feat-camera-capture-stack`, about thirty items:

| Stage | Subject                   | Source                                                           |
| ----- | ------------------------- | ---------------------------------------------------------------- |
| 1     | Correctness               | GitHub issue #385, 8 items                                       |
| 2     | Performance               | `performance.md` at the repo root, 12 items                      |
| 3     | Maintainability and tests | `CAMERA-SEAM-REVIEW-STAGE-3.md` at the repo root, about 10 items |

Items are split by file and by what has to be one copy before it is safe to
touch, not by severity. Stage 3's "duplication" section is an interrupted
refactor rather than an intentional design, so finishing that refactor came
first and collapsed six other items into one-place fixes.

## 2. Branch stack

Each whole feature is its own branch. Nothing merges back to
`feat-camera-capture-stack` until a whole feature is complete.

```
feat-camera-capture-stack                          c771e43
  └── refactor-camera-capture-workflow             4b1eeb9   COMPLETE, all green
        └── 04af5ad  android camera session setup (#385)
              ├── feat-android-camera-setup        COMPILED AND DRIVEN
              └── feat-ios-camera-setup   89f5912  WRITTEN, NEVER COMPILED
```

The two platform branches are **siblings**, both sitting on `04af5ad`. They are
not stacked. That matters now: the pinch-zoom flag described in section 4.5
touches Swift files on the Android branch, so `feat-ios-camera-setup` will need
that change merged or re-applied rather than assuming it is absent.

`feat-android-camera-setup`, oldest first:

| Commit                           | What                                                             |
| -------------------------------- | ---------------------------------------------------------------- |
| `76183e3`                        | Report camera session diagnostics from the Android view          |
| `74865cd`                        | Load `.env.android.local` for Android builds only                |
| `af314b9`                        | Take camera test-drive defaults from the environment             |
| (uncommitted at time of writing) | Preview sizing, single bind, pinch delivery, `camera_pinch_zoom` |

## 3. Constraints that govern the remaining work

From the code author, and binding on both platforms:

1. **Keep the native-view contract narrow.** Camera session setup,
   focus/metering, zoom and capture belong to the Expo view. The React Native
   layer owns the screen, permissions, settings, captured-photo state, the
   upload and save flow, and analytics. Deleting a captured file is part of the
   application workflow, so it belongs to the RN layer — that is where it went.
2. **Preserve `modules/native-identification-camera/src/types.ts` when changing
   the bridge.** Result fields and commands stay explicit. Do not expose
   framework objects. Do not create a second app-level photo-submission
   pipeline.
3. **VisionCamera stays the default and the fallback.** Do not make the native
   backend mandatory and do not remove the fallback as a side effect of
   refactoring. A backend change needs an explicit product decision plus
   evidence that supported devices and release builds include it.
4. **Keep platform tuning platform-specific.** Do not copy Android exposure or
   low-light policy to iOS to make the settings look symmetric. Use each
   platform API's capability checks and documented fallback behaviour. No
   hard-coded device-model lists. No invented low/mid/high device tiers.
5. **`maxDetail` and `motionPriority` live in a config file.**

Environment constraints:

- **Android only.** No iOS device and no iOS simulator are available.
- **No macOS runner** on the GitHub plan, so Swift gets no compile check in CI
  either. A local Swift compiler setup was being attempted; until it exists,
  every Swift change in section 5 is eyes-only and must be reported as "needs
  test drive", never as verified.

---

## 4. Android — `feat-android-camera-setup`

### 4.1 Status

Compiled and driven on a **Pixel 7** (`panther`, arm64-v8a, Android 17) against
**live Firebase**. Six of the run note's checks are answered. The run note is
`docs/test-drives/run-notes/2026-09-28-feat-android-camera-setup.md`.

| #   | Check                                                                     | Result                               |
| --- | ------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Capture reports real dimensions, including straight after a position flip | pass, both sensors                   |
| 2   | Tap focuses and does not fire the shutter                                 | pass                                 |
| 3   | Pinch and tap coexist                                                     | cause found and fixed; not re-driven |
| 4   | One bind per change                                                       | pass                                 |
| 5   | `camera_device_ready` carries `capture_tuning`                            | pass (`detail_and_motion`)           |
| 6   | Portrait height exceeds width                                             | pass, via EXIF                       |

Capture payloads, one per sensor:

| Sensor | stored    | `exif_orientation` | `axes_swapped` | reported  |
| ------ | --------- | ------------------ | -------------- | --------- |
| back   | 4032x2268 | 6                  | true           | 2268x4032 |
| front  | 3264x2448 | 8                  | true           | 2448x3264 |

The Kotlin compiled clean on the first attempt, against the earlier expectation
that roughly 300 uncompiled lines would produce errors.

### 4.2 What the drive found, and what fixed it

**The preview was blank while the session streamed normally.** CameraX was
healthy throughout — `session_bound`, `camera_device_ready`,
`StreamStateObserver: Update Preview stream state to STREAMING` — and captures
produced correct files. The failure was size:

```
W PreviewTransform: Transform not applied due to PreviewView size: 1080x0
```

The native view was laid out 485.39 x **0** dp. Proved by probe: with the
`GestureDetector` removed entirely and `StyleSheet.absoluteFill` on the view, it
still measured zero height, so neither the gesture nor the Android measure pass
was responsible. `position: absolute` with all four insets does not resolve a
height on this Expo Fabric view. The fix is `flex: 1` in `index.styles.ts`
(`cameraFill`), which works because the preview is the only in-flow child of the
camera screen's root — the chrome, the flash overlay and the thumbnail strip are
all absolutely positioned. **Why Yoga resolves the horizontal insets and not the
vertical ones on that view is still unexplained.** The style carries a comment so
nobody reverts it.

**A cold mount bound the session twice.** Diagnostics, first camera open:

| Time         | Event           | bind_count |
| ------------ | --------------- | ---------- |
| 17:33:32.555 | session_bound   | 1          |
| 17:33:32.558 | session_unbound | 1          |
| 17:33:32.563 | session_bound   | 2          |

Bind 1 lived 3 ms. Two paths reached the first session: the
`ProcessCameraProvider` listener in `init` bound directly when `isActive` was
already true, while the prop path had separately scheduled a rebind. The
listener now raises `needsRebind` and calls `applyPendingConfiguration()`
instead of binding, and a `rebindScheduled` guard keeps the posted rebind
single. Either caller alone still binds. After the fix a cold mount reports one
`session_bound` with `bind_count: 1`, and each later prop change costs exactly
one unbind and one bind.

**The first capture failed with `Camera is closed.` after 7.2 s**, then later
captures worked. It did not recur after the bind fix, which is the expected
result of capturing against an `ImageCapture` whose session had just been torn
down — but one clean run is not proof.

### 4.3 Pinch to zoom: why it never worked

Not timing, not the device. `react-native-gesture-handler` 2.31.2 chooses how to
deliver a touch by view class (`NativeViewGestureHandler.kt:82-91`): a
`ReactViewGroup` gets `dispatchTouchEvent`, everything else gets `onTouchEvent`.
`ExpoView` extends `LinearLayout`, so our view took the default. That defeats a
detector on a child view twice over — `onTouchEvent` neither descends to
children nor invokes an `OnTouchListener`, and the detector lived on
`previewView.setOnTouchListener`.

Worse, `onHandle` forwards nothing until the handler activates, and it activates
on `onInterceptTouchEvent` returning true or on `view.isPressed`. Both are false
for a `LinearLayout`, so the handler sat in `BEGAN` and no event ever reached the
view at all. Overriding `onTouchEvent` alone would not have been enough.

Fixed on Android only, by explicit decision, with no behavioural change to the
shared contract: the `ScaleGestureDetector` moved onto the view's own
`onTouchEvent`, and `onInterceptTouchEvent` claims the gesture so RNGH activates
and forwards the stream. `Gesture.Simultaneous` keeps the JavaScript
tap-to-focus recognizer alive beside it.

### 4.4 Diagnostics

The view reports session diagnostics when the `camera_performance_checks`
setting is on, which drives the `diagnostics` prop. It does **not** link an
analytics SDK of its own: events go out through `onCameraDiagnostic` to
`captureEvent`, so there is one analytics-consent gate and one distinct id
rather than a second native set of both.

| `native_event`           | Answers                                      | Key fields                                                                         |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `session_bound`          | check 4, and whether a cold mount binds once | `bind_count`, `capture_tuning`, `capture_mode`, `bind_duration_ms`                 |
| `session_unbound`        | pairs with the above                         | `bind_count`                                                                       |
| `session_bind_failed`    | a bind that never reported ready             | `message`                                                                          |
| `capture_saved`          | checks 1 and 6                               | `stored_width/height`, `reported_width/height`, `exif_orientation`, `axes_swapped` |
| `capture_failed`         | a capture that errored                       | `image_capture_error_code`                                                         |
| `capture_no_dimensions`  | the 0x0 path, if it still happens            | `elapsed_ms`                                                                       |
| `focus_requested`        | checks 2 and 3                               | `accepted`, `reason`, `normalized_x/y`                                             |
| `subject_region_ignored` | a tap arriving with metering off             | `subject_metering`                                                                 |
| `pinch_ended`            | check 3, one per pinch                       | `zoom_ratio`                                                                       |

Read them in Metro's log:

```
grep camera_native_diagnostic .expo/dev/logs/start.log
```

Beware two log artefacts. PostHog batch flushes reprint queued events with one
shared timestamp, so repeated lines at an identical time are not repeated
activity. And the diagnostics print pretty-printed across several lines, so a
single-line grep pattern misses them.

### 4.5 Settings and environment

`camera_pinch_zoom` is new and ships **off**: a zoomed capture is a cropped
capture, and an identification photograph is worth more at full sensor width.
Off means the view claims no touch at all, so the whole gesture stays with the
JavaScript tap-to-focus recognizer. It is wired through `types.ts`, both
platforms, the settings store and the Settings screen.

Three settings that ship off must be on for a native-camera drive, so they take
their defaults from the environment rather than three manual toggles per run:

| Setting                     | Ships as | Environment variable                    |
| --------------------------- | -------- | --------------------------------------- |
| `native_camera_capture`     | false    | `EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE`     |
| `camera_performance_checks` | false    | `EXPO_PUBLIC_CAMERA_PERFORMANCE_CHECKS` |
| `camera_subject_metering`   | false    | `EXPO_PUBLIC_CAMERA_SUBJECT_METERING`   |

They live in `.env.android.local`, read only by `scripts/run-android.sh` — Expo
builds its own file list from `NODE_ENV`, which is never "android", so that file
is inert for iOS, for `expo start` and for every other command. Expo skips a
variable already present in the environment (`@expo/env/build/index.js:402`),
which is what lets the script's value win over `.env.local`. These are
**defaults, not overrides**: a value already persisted on the device wins, and
`npm run android` clears app storage first, so a drive starts from the
environment. The script echoes every key it defines at startup, so a drive log
records what the build actually got.

Expo inlines `process.env.EXPO_PUBLIC_*` only for a **literal** member
expression, so `process.env[key]` reads nothing. Each call site in
`useSettingsStore.ts` names its variable literally.

### 4.6 Two setup facts that cost a drive

- **Emulator mode cannot be used on a physical device.** Google Sign-In returns
  a real Google ID token and the Firebase Auth emulator cannot verify one, so
  `signInWithCredential` stalls for 60 s and fails with
  `FirebaseNetworkException`. `.env.android.local` now sets
  `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false`. Use emulator mode only with a
  sign-in path that does not need Google to vouch for the token.
- **firebase-tools now refuses Java below 21.** Gradle stays on JDK 17, which is
  correct; start the emulator suite with JDK 25 on `PATH` instead.

### 4.7 Android — what is left

1. **Re-drive pinch to zoom**, with `camera_pinch_zoom` turned on, and confirm
   `pinch_ended` fires and `focus_requested` keeps firing beside it.
   Deprioritised at the time of writing.
2. **Write the implementation note** for the Android work, appended to
   `docs/implementations/2026-08-01-sprint-camera-implementation.md` as a dated
   section.

---

## 5. iOS — `feat-ios-camera-setup`

Written and committed as `89f5912`. **Nothing was compiled and nothing was
driven**: no device, no simulator, no macOS CI runner and no local Swift
toolchain. Report every item here as "needs test drive", never as fixed.

### 5.1 Items, and where each one stands

| #   | Item                                                        | State                                                   |
| --- | ----------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Stage 3 §1.1 — de-duplicate the exposure-cap heuristic      | done, `ios/CameraExposurePolicy.swift`                  |
| 2   | Stage 1 #1 — restore shared device state                    | done, `SavedDeviceState` plus `restoreDeviceState`      |
| 3   | Stage 1 #2 — settle the capture promise                     | done, both callbacks route through one settle-once path |
| 4   | Stage 2 #6 — stop configuring the session twice on mount    | done, `needsSessionConfiguration` starts true           |
| 5   | Stage 2 #7 — coalesce the policy reconfigurations           | done, `applyPendingConfiguration()`                     |
| 6   | Stage 2 #9 — hoist the date formatter                       | resolved by item 7                                      |
| 7   | Remove `capturedAt` from the Swift capture result           | done                                                    |
| 8   | Mirror the Android tuning config without copying the policy | done, `ios/CaptureTuning.swift`                         |
| 9   | Rationale comments — Stage 3 §4                             | done                                                    |

Two details worth keeping, because both were nearly got wrong:

- **The teardown hook is `prepareForRecycle`, not `deinit`.** Expo's iOS
  `ViewLifecycleMethodType` has exactly one case, `didUpdateProps`, so there is
  no Expo lifecycle teardown method on iOS at all. `prepareForRecycle` is the
  Fabric-level equivalent (`ExpoFabricViewObjC.h:65`, `RCTViewComponentView.h:76`)
  and it is the right one twice over: `didMoveToWindow` fires on transient
  detaches, and Fabric recycles views, so teardown has to reset the instance
  rather than assume it is being destroyed. It requires `super`.
- **The tuning tables mirror Android's shape, not its policy.** iOS maps
  `(true, true)` to `.balanced` where Android maps it to zero-shutter-lag. That
  disagreement is deliberate and is open decision 1 in section 6. The
  `telemetryName` values match Android so a single query can compare them:
  `detail_and_motion`, `detail_only`, `motion_only`, `neither`.

### 5.2 What iOS still needs

1. **Pick up the diagnostics.** `diagnostics` and `onCameraDiagnostic` are
   declared in the shared `types.ts` but implemented only on Android. Expo
   ignores an unsupported prop, so today they are inert on iOS rather than
   broken — but every drive finding in section 4.2 came from those events, and
   an iOS drive without them will be guesswork.
2. **Take the pinch-zoom flag.** `pinchZoom` was added to `types.ts` and to the
   Swift view **on the Android branch**, because the two platform branches are
   siblings. Merge or re-apply rather than assuming it is absent, and check for a
   conflict in `NativeIdentificationCameraView.swift` and
   `NativeIdentificationCameraModule.swift`.
3. **Check the preview sizing.** The blank-preview fault in section 4.2 was a
   React Native layout fault on a shared screen, so it applied to both platforms.
   It is fixed in `index.styles.ts` and needs no iOS change, but confirm on a
   device that the `flex: 1` preview fills the screen under AVFoundation's
   `previewLayer` as well.

### 5.3 iOS verification plan, given no device

- Compile locally if a Swift toolchain ever exists; otherwise state plainly that
  nothing was compiled.
- `swiftlint` if it can be installed.
- Items 1, 6, 7 and 9 above are checkable by reading. Items 2 and 3 are invisible
  in a simulator even when one exists and genuinely need a device session.
- Issue #385 cannot be closed as verified from here. Its two blockers are both
  iOS. Fix the code, leave the issue open, and say why.

---

## 6. Open decisions — yours, not the agent's

1. **What `(maxDetail: true, motionPriority: true)` should mean.** Android
   resolves it to zero-shutter-lag; iOS resolves it to `.balanced`, which is
   neither priority. Both props default to true, so this is the pair a default
   install always uses, and `CAPTURE_MODE_MAXIMIZE_QUALITY` is never exercised
   by default. The code is now set up so you can decide from data: every
   combination is reachable, the mapping is one named table per platform, and
   the resolved mode is reported in telemetry. This is what the on-device
   profiling run is for, and it is why this work is not on `main`.

2. **Whether an on-device denoiser and/or a bounding-box detector will run.**
   This gates CameraX versus Camera2, because a RAW requirement may force
   Camera2. Recorded as an open gate in the Kotlin class comment with the
   checklist that has to be filled in first. Nothing in the code assumes an
   answer.

3. **The vocabulary and configuration sweep, which is a separate feature and not
   started.** Stage 3 §2 and §3:
   - `capture_pipeline` and `capture_backend` are two field names for one
     concept, so no query can span both paths.
   - `camera_variant` carries real values on the legacy path and the constant
     `native` on the other.
   - `camera_backend` mixes a JavaScript library name, `visioncamera`, with
     native framework names, `avfoundation` and `camerax`.
   - Eight settings booleans with mixed default polarity, `!== false` in some
     places and `=== true` in others. Commit `4e3a2cf` already had to correct
     this once.
   - `camera_disable_low_light_boost` names the negative while the legacy path's
     `enableLowLightBoost` names the positive.
   - `maxDetail` and `motionPriority` are opaque names for five effects across
     two languages, against a descriptive-first convention.
   - Nothing records which combinations are valid, for example that
     `ios_improved_camera_capture` becomes dead once `native_camera_capture` is
     on.

   Renaming telemetry fields must be one commit or queries break mid-series.
   Renaming settings keys needs a migration decision for already-persisted
   values — that is the part that needs you.

4. **Continuous integration, also a separate feature and not started.** Stage 3
   §7. No workflow runs `gradlew`, `xcodebuild`, `expo prebuild`, `ktlint` or
   `swiftlint`, so roughly 970 lines of Kotlin and Swift are validated only by
   whoever last built locally, and the branch history contains two commits
   removing a temporary typecheck workflow. Compounding it,
   `modules/native-identification-camera/android/build.gradle` sets
   `lintOptions { abortOnError false }`, so Android lint failures are ignored
   inside the module and nothing runs lint from outside it.

   Suggested split, matching the repo's fast-versus-expensive rule: Kotlin
   compile, `ktlint`, `swiftlint` and the contract test on pull requests;
   `expo prebuild` plus full Android and iOS builds on main or on a schedule.
   Swift compilation needs a macOS runner, which is not available on the current
   plan — that is the decision to make.

---

## 7. The docs submodule

`docs/` is a submodule, and it was blocked: sitting on
`issue-371-improve-app-journey` with unrelated uncommitted work, so committing a
camera note there would have landed it on someone else's feature branch mixed
with their in-progress edits.

Resolved on 2026-09-28 by the decision to raise a pull request for
`issue-371-improve-app-journey` as it stands, and to open a **new docs branch**
for the camera rework. The camera documents go on that new branch:

- `test-drives/run-notes/2026-09-28-feat-android-camera-setup.md` — the drive
  itself, both runs, with the findings that section 4.2 summarises.
- `implementations/2026-08-01-sprint-camera-implementation.md` — the dated
  section for the React Native refactor, still to be extended for the Android
  work.
- `PROJECT_STRUCTURE.md` — `modules/` was missing from the folder map entirely.
- `agents/domain.md` — Camera seam, Capture backend and Capture tuning, plus a
  standing note that the camera telemetry and settings vocabulary is under an
  unresolved sweep and must not be extended yet.

The usual sequence still applies afterwards: commit in the submodule first, then
bump the pointer in the parent repo, in the same pull request as the code.

Note the repo's own rule was already bent once. Documentation is supposed to ship
in the same commit as the code it describes, and the seven commits on
`refactor-camera-capture-workflow` landed without their note.

`CONTEXT.md` was deliberately reduced to a redirect stub by commit `f222fec`,
which merged its vocabulary into `agents/domain.md`. It is left alone; the camera
vocabulary went into `domain.md` where the rest of it lives.

---

## 8. Quick start for the next session

```
git checkout feat-android-camera-setup
git status
```

Android is compiled, driven and working: preview visible, one bind per change,
captures reporting correct dimensions on both sensors. What is genuinely open,
in rough priority order:

1. **The profiling run** that open decision 1 exists for — every tuning
   combination is reachable, each platform has one named table, and the resolved
   mode is reported in telemetry, so the decision can now be made from data
   rather than argument. This is why the work is not on `main`.
2. **iOS**: compile it somehow, then drive it. Section 5.2 lists what it needs
   first.
3. **Re-drive pinch** with `camera_pinch_zoom` on.
4. **The vocabulary sweep** and **the native-code CI split**, open decisions 3
   and 4. Neither is started.

One unexplained behaviour is on the record rather than fixed: `position:
absolute` with all four insets resolves to zero height on the Expo Fabric camera
view, while the same style works on ordinary views. The workaround is `flex: 1`
and it carries a comment. If that ever needs explaining rather than avoiding,
section 4.2 has the probe that isolates it.
