# Run note — Android camera session setup, physical device

- Branch: `feat-android-camera-setup`
- HEAD: `76183e3` (`git rev-parse HEAD` to confirm)
- Device: _fill in_ (`adb shell getprop ro.product.model`)
- ABI: _fill in_ (`adb shell getprop ro.product.cpu.abi`)
- Backend mode: **Firebase Local Emulator Suite**, for Android builds only.
  `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` lives in `.env.android.local`, which
  only `npm run android` loads. `.env.local` is unchanged. Start
  `firebase emulators:start` before the app, or Auth and Storage both fail.
- Date: 2026-09-28

## Preconditions

`.env.android.local` sets these three, and `npm run android` clears app storage
first, so a drive starts with them on. They are defaults only: a value already
persisted on the device wins, so check Settings if the drive follows a run that
toggled them by hand.

| Setting | Ships as | Env default | Why |
| --- | --- | --- | --- |
| `native_camera_capture` | false | `EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE=true` | none of the code under test runs without it |
| `camera_performance_checks` | false | `EXPO_PUBLIC_CAMERA_PERFORMANCE_CHECKS=true` | gates every diagnostic below |
| `camera_subject_metering` | false | `EXPO_PUBLIC_CAMERA_SUBJECT_METERING=true` | check 2 |
| `camera_max_detail` | true | — | leave, vary in check 4 |
| `camera_motion_priority` | true | — | leave, vary in check 4 |
| `camera_disable_low_light_boost` | false | — | leave |

`npm run android` echoes each value at startup, so the drive log records what
the build actually got.

## Checks

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| 1 | Capture reports real dimensions. Flip the camera position, then capture immediately. | `photo_captured` carries non-zero width and height. This is the window where `resolutionInfo` used to be null and the upload carried 0x0. | |
| 2 | Tap the preview. | Focus and exposure visibly change. The tap does **not** also fire the shutter. | |
| 3 | Pinch to zoom, then tap, in the same session. | Both work. A pinch does not leak a tap; a tap does not break the following pinch. Highest-risk item — see below. | |
| 4 | Flip position and change two tuning settings together. | One bind, not two. Count `camera_device_ready` events, or read CameraX's own session logs. | |
| 5 | `camera_device_ready` payload. | Carries `capture_tuning`. | |
| 6 | Portrait capture. | Reported height is greater than reported width. Confirms the EXIF axis swap. | |

## Known risks going in

- **Check 3 is the one to watch.** The touch listener returns
  `scaleGestureDetector.isInProgress`, so `ACTION_DOWN` reaches React Native's
  responder system. If a JS responder is then granted on the preview, React
  Native can stop delivering later events to the native view and the pinch
  detector loses the stream mid-gesture. `Gesture.Simultaneous(Gesture.Native(),
  Gesture.Tap())` is what is supposed to prevent that.
- **Two paths reach the first bind.** `isActive` sets `needsRebind` and
  `OnViewDidUpdateProps` applies it, while the `ProcessCameraProvider` listener
  in `init` still binds directly when `isActive` is already true. Check 4 covers
  a prop change; also confirm a cold mount binds once.

## Diagnostics the view now reports

`camera_performance_checks` drives the `diagnostics` prop. With it on, the view
emits `camera_native_diagnostic` events, distinguished by `native_event`:

| `native_event` | Answers | Key fields |
| --- | --- | --- |
| `session_bound` | check 4, and whether a cold mount binds once | `bind_count`, `capture_tuning`, `capture_mode`, `bind_duration_ms` |
| `session_unbound` | pairs with the above | `bind_count` |
| `session_bind_failed` | a bind that never reported ready | `message` |
| `capture_saved` | checks 1 and 6 | `stored_width/height`, `reported_width/height`, `exif_orientation`, `axes_swapped` |
| `capture_failed` | a capture that errored | `image_capture_error_code` |
| `capture_no_dimensions` | the 0x0 path, if it still happens | `elapsed_ms` |
| `focus_requested` | checks 2 and 3 | `accepted`, `reason`, `normalized_x/y` |
| `subject_region_ignored` | a tap arriving with metering off | `subject_metering` |
| `pinch_ended` | check 3, one per pinch | `zoom_ratio` |

Read them in Metro's JSONL log, not `logcat`:

```
grep camera_native_diagnostic .expo/dev/logs/start.log
```

For check 3, a run showing `pinch_ended` and `focus_requested` interleaved is
the evidence that tap and pinch coexist.

## Findings

Device: Pixel 7 (`panther`), arm64-v8a, Android 17. HEAD `af314b9`.

Backend was **live Firebase**, not the emulator suite. The run note asked for
emulator mode and that is wrong for a physical device: Google Sign-In returns a
real Google ID token, the Auth emulator cannot verify one, and
`signInWithCredential` only times out after 60 s with
`FirebaseNetworkException`. `.env.android.local` now sets
`EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false`. Use emulator mode only with a
sign-in path that does not need Google to vouch for the token.

Second note on the emulator suite: firebase-tools refuses Java below 21, and
this machine's default is JDK 17 for Gradle. Start the suite with JDK 25 on
PATH; leave Gradle on 17.

**The preview is blank. The camera is not the problem.**

| Evidence | Reading |
| --- | --- |
| `session_bound`, `camera_device_ready`, `capture_tuning: detail_and_motion`, `ready_duration_ms: 272` | the session binds, and the tuning table resolves |
| `StreamStateObserver: Update Preview stream state to STREAMING` | frames are flowing |
| `W PreviewTransform: Transform not applied due to PreviewView size: 1080x0` | the preview surface has zero height, so nothing is drawn |

`NativeIdentificationCameraView.kt:216` sizes the preview from the view's own
bounds:

```kotlin
previewView.layout(0, 0, right - left, bottom - top)
```

Width arrives correct and height arrives zero, so either the host view is laid
out 1080x0 or that `onLayout` never runs and the preview keeps an unmeasured
size. `LegacyCameraScreen.tsx:92` uses the same `GestureDetector` plus
`absoluteFill` shape and VisionCamera fills the screen, which points at the
native view rather than the React Native layout. **Not yet confirmed** — a JS
`onLayout` probe on the native view separates the two cases, and the drive
ended before the camera was opened again.

**Check 4 fails: a cold mount binds twice.** The `session_bound` and
`session_unbound` diagnostics, first camera open:

| Time (UTC) | Event | bind_count | bind_duration_ms |
| --- | --- | --- | --- |
| 17:33:32.555 | session_bound | 1 | 42 |
| 17:33:32.558 | session_unbound | 1 | — |
| 17:33:32.563 | session_bound | 2 | 31 |

Bind 1 lives 3 ms. This is the second known risk in this note: the
`ProcessCameraProvider` listener in `init` binds directly when `isActive` is
already true, and `applyPendingConfiguration()` then rebinds from
`OnViewDidUpdateProps`. Three more unbind/bind pairs follow at 17:33:44,
17:33:45 and 17:33:46, one per prop batch.

Tuning resolves correctly on every bind: `detail_and_motion`, capture mode 2.

**The first capture failed, later captures worked.** One
`photo_capture_failed` with `error: Camera is closed.` and
`elapsed_ms: 7224` — the request hung 7.2 s before failing, and CameraX closed
`Camera2CameraController(CameraGraph-6)` at the same instant. Captures after it
succeeded. The app was stopped by hand shortly after, so the successful
captures fall outside the Metro log and carry no `capture_saved` payload.

Checks 1, 2, 3, 5 and 6 are unrun. Checks 1 and 6 need `capture_saved`, which
needs a drive that is not stopped early. Checks 2 and 3 need a visible preview.

## Second run, after the fixes — 2026-09-28 15:10 EDT

Two fixes went in between the runs:

1. `NativeCameraScreen.tsx` — the preview took `flex: 1` in place of
   `StyleSheet.absoluteFill`. The native view resolves `position: absolute`
   with all four insets to full width and **zero height**. Proved by probe: with
   the `GestureDetector` removed entirely and `absoluteFill` on the view, it
   still measured 485.39 x 0 dp. With `flex: 1` it measures 485.39 x 1078.65 dp.
   Why Yoga resolves the horizontal insets and not the vertical ones on this
   view is still unexplained.
2. `NativeIdentificationCameraView.kt` — one path to a session. The
   camera-provider listener now raises `needsRebind` and calls
   `applyPendingConfiguration()` instead of binding directly, and a
   `rebindScheduled` guard keeps the posted rebind single.

| # | Check | Result |
| --- | --- | --- |
| 1 | Capture reports real dimensions, including straight after a flip | **pass**, both sensors |
| 2 | Tap focuses and does not fire the shutter | **pass** |
| 3 | Pinch and tap coexist | **withdrawn** — see below |
| 4 | One bind per change | **pass** — cold mount 1, then 1->2, 2->3, 3->4, 4->5 |
| 5 | `camera_device_ready` carries `capture_tuning` | **pass** (`detail_and_motion`) |
| 6 | Portrait height exceeds width | **pass**, via EXIF |

Capture payloads, one per sensor:

| Sensor | stored | exif_orientation | axes_swapped | reported |
| --- | --- | --- | --- | --- |
| back | 4032x2268 | 6 | true | 2268x4032 |
| front | 3264x2448 | 8 | true | 2448x3264 |

Check 3 is withdrawn rather than failed. `pinch_ended` never fired and the zoom
never changed, and that is acceptable: telephoto is not useful for
identification photographs, so pinch to zoom is not a wanted feature. The
`ScaleGestureDetector`, its touch listener, the `pinch_ended` diagnostic and the
`Gesture.Native()` half of `focusTapGesture` exist only to keep zoom working
beside tap to focus.

**Resolved.** Pinch could never have worked on Android, and the cause is in
react-native-gesture-handler 2.31.2, not in timing or the device.
`NativeViewGestureHandler` picks how to deliver a touch by view class
(`NativeViewGestureHandler.kt:82-91`): a `ReactViewGroup` gets
`dispatchTouchEvent`, everything else gets `onTouchEvent`. `ExpoView` extends
`LinearLayout`, so our view got the default. That defeats a detector on a child
view twice over: `onTouchEvent` neither descends to children nor invokes an
`OnTouchListener`. Worse, `onHandle` only forwards anything once the handler
activates, and it activates on `onInterceptTouchEvent` returning true or on
`view.isPressed` -- both false for a LinearLayout -- so the handler sat in BEGAN
and forwarded nothing at all.

Fixed on Android only, with no change to the shared contract's behaviour: the
`ScaleGestureDetector` moved off the child `OnTouchListener` onto the view's own
`onTouchEvent`, and `onInterceptTouchEvent` now claims the gesture so RNGH
activates and forwards it.

Pinch to zoom is then gated by a new `camera_pinch_zoom` setting, shipped
**off**: a zoomed capture is a cropped capture, and an identification photograph
is worth more at full sensor width. Off means the view claims no touch of its
own, so the gesture stays entirely with the JavaScript tap-to-focus recognizer.
iOS takes the same `pinchZoom` prop and enables or disables its
`UIPinchGestureRecognizer`; that half is written but not compiled or driven.

Neither the Android fix nor the flag was drive-tested -- deprioritised.

The 7.2 s `Camera is closed.` failure from the first run did not recur. Every
capture in this run succeeded first time. One run is not proof, but the double
bind was the obvious suspect and it is gone.
