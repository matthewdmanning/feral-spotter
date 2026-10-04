# Test drive: `dev/camera-android-ready`

- Git state: `c664caf75f9168c5e91618c0af9f55dd6a7b95db`, detached HEAD at `dev/camera-android-ready` (`git branch --show-current` is empty)
- Device: Pixel 7 (physical)
- Backend: Firebase Local Emulator Suite (Auth + Storage), `adb reverse` to `localhost`
- Env for this build (`.env.android.local`, local only, restored after the drive):
  - `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` (file value was `false`)
  - `EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE` commented out, so the branch's code default applies
- Sign-in: email/password only. The Auth emulator cannot verify a Google credential.

## Purpose

The primary check: native capture is on by default without the env override (`useSettingsStore.ts`, default `false` → `true`).

## Checks

| #   | Check                                                | How                                                                                  | Result                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Startup log shows emulator mode                      | Metro log, auth + upload startup lines                                               | PASS. `[firebase] mode: emulator`, no `10.0.2.2` remap line. The account `drive20261004@example.com` is in the Auth emulator (`accounts:query`, 1 record).                                                                                                   |
| 2   | Native capture is on by default                      | Settings shows it on after `pm clear`; camera opens with `capture_backend: 'native'` | Settings: PASS. After `pm clear`, with the env line commented out, "Native Camera Capture" `checked="true"`. Camera: see below.                                                                                                                              |
| 3   | Tap to focus calls `focus`, not `applySubjectRegion` | Tap preview; logcat / Metro                                                          | PASS. Tap at (540,900) → `CXCP startFocusAndMetering: updating 3A regions & triggering AF`, then `Result3A(status=0)`. Camera: native module `expo.modules.nativeidentificationcamera` + CameraX `Preview`/`ImageCapture`; 0 `VisionCamera` lines.           |
| 4   | Photo count badge shows the current count            | Take 3 photos → last thumb badge 3; remove one → 2                                   | PASS (user, by eye, on a second try). The badge equalled the photo count before and after removing photos.                                                                                                                                                   |
| 5   | Keep on device saves to gallery                      | "Keep Photos on Device" was on by default; photos appear in the gallery              | PASS (user, by eye). The drive photos are in Google Photos. MediaStore was not read (adb hang).                                                                                                                                                              |
| 6   | PostHog fires only with consent                      | Metro JSONL log                                                                      | PASS (consent off). Analytics turned off on the consent screen; 0 PostHog/analytics lines in the 25 session lines. Control: 200 PostHog lines from earlier sessions in the same file, so the channel does record them. The "consent on" case was not driven. |
| 7   | GPS capture fires                                    | logcat, unfiltered                                                                   | PARTIAL. Metro: `[location] watchPositionAsync resolved, subscription live` on opening the camera. The system location-provider lines in logcat were not read (adb hang).                                                                                    |

## Findings

### adb hangs on the camera screen (blocker, open)

- adb stopped responding 3 times (`adb devices` exit 124). Each time, a `uiautomator dump` had just run. The 2nd and 3rd times, the live camera preview was on screen.
- The app did not crash. After an adb restart, `pidof` returned the same PID (24521).
- After 3 shutter taps, the dump showed `Done (1)`. The adb hang probably dropped 2 of the taps. This is not yet a finding about the app.
- Every adb restart drops the `adb reverse` tunnels. Add them again.
- 4th hang: no `uiautomator` was involved. It happened during `content query` / `run-as find`. So the hangs are not caused only by `uiautomator`.
- Metro logged `[timeout] connection terminated with Device … after not responding` twice (14:10:46 and 14:15:10 local). This agrees with a USB/adb link problem.
- MediaStore image count before the manual photos: 1766. I could not read the count after the photos (adb hang).
- The user took the photos and removed one by hand. The badge result depends on what the user saw on the screen.
- 5th hang: it happened after the USB reconnect, on the first `content query` against MediaStore. `adb devices`, `reverse` and `pidof` worked just before it. So a new cable connection did not fix it.
- The 1st hang (`pm clear` at the start of the rebuild) happened while the dev menu was on screen, not the camera. So the hangs are not specific to the camera screen.
- User report (by eye): "I think it was 7." (number of photos or badge value not confirmed)

### Setup blockers

- `firebase emulators:start` fails on JDK 17 ("no longer supports Java version before 21"). Worked with `JAVA_HOME` set to JDK 25 for that process only.
- `expo run:android` opened the dev client on the LAN IP (`172.16.226.216:8081`) → `NoRouteToHostException`. Worked after opening `exp+feral-spotter://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081` with `adb shell am start`.
- `expo run:android` restarts adb, which drops the `adb reverse` tunnels for 9099 and 9199. Add them again after the build.
- **Emulator mode does not work on a physical device as documented.** `backend.md` says "`localhost` + `adb reverse` on a physical device". `@react-native-firebase/auth` and `/storage` change `localhost` and `127.0.0.1` to `10.0.2.2` on Android, unless `firebase.json` sets `react-native.android_bypass_emulator_url_remap: true`. This repo's `firebase.json` does not set it. Metro log: `Mapping auth host "localhost" to "10.0.2.2" for android emulators. Use real IP on real devices.`
