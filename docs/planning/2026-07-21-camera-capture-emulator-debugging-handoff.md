# Camera capture — handoff notes (2026-07-21)

## Unfixed

**`MediaLibrary.saveToLibraryAsync` throws — fix written, never confirmed on-device.**

Root cause: `saveToLibraryAsync` imported from top-level `expo-media-library` is a
deprecated stub in the installed SDK version that unconditionally throws
(`node_modules/expo-media-library/src/legacyWarnings.ts`). It was called inside the
same `try` block as `setCapturedPhotos(...)` in
`src/hooks/useCameraCapture.tsx:handleTakePhoto`, *before* that state update — so the
throw aborted the function early. `addSessionPhoto`/`addPhoto` ran fine (they're above
the save call), but the camera screen never showed the captured photo (no strip
thumbnail, no Done pill). This is very likely the real cause behind the "still asked
to select photos" report — the OS's own Selected-Photos-Access picker (triggered
separately, by the *pre-#48/#49* `requestPermissionsAsync()` call requesting granular
read permission) was a red herring layered on top of this.

Fix (uncommitted): swap to `MediaLibrary.Asset.create(uri)` (the new class-based API,
compatible with the writeOnly permission model from #49), move
`setCapturedPhotos`/store writes ahead of the gallery-save step, and isolate the save
in its own try/catch so a save failure can never hide a successful capture.

State: sits only in the working tree on scratch branch `test-combined-camera-fixes`
(local merge of `issue-41-contextual-repriming` + `issue-32-camera-screen-fixes`,
created purely to test both fix sets together — not a real branch, don't push it).
Typechecks clean. **Never successfully observed running** — the emulator died on both
attempts to verify it, before or right at the point of taking a test photo.

Next: get the emulator stable, do one clean single-tap capture on a **freshly
uninstalled** install of that branch's code, confirm the Done pill appears immediately
after one shutter tap and the photo lands in `usePhotoStore.photos` downstream. Then
file the GitHub issue (sub-issue of #41 — same file/area as #48/#49), commit onto
`issue-41-contextual-repriming`, and delete `test-combined-camera-fixes`.

## Emulator debugging lessons

- **The emulator can go away mid-session with no in-band signal** — it happened twice
  here from the user closing it, not a crash. First symptom is usually `adb devices`
  returning nothing, or `expo run:android` failing with
  `Error: could not connect to TCP port 5554: ... actively refused`. Check
  `adb devices` before trusting any build/install step; if it's empty, the emulator
  needs restarting (user's side — Claude can't relaunch the AVD itself, only run
  adb/build commands against it).
- `adb devices` can report a device as `offline` for several seconds right after a
  restart/reconnect — poll until the state column reads exactly `device`, not just
  until the line appears.
- **Reinstalling does not wipe app data.** `expo run:android` / `adb install -r`
  preserves persisted storage, so zustand+asyncStorage state (draft submissions,
  captured photos, garbage typed into form fields from a prior test) survives across
  rebuilds. This caused a false-positive "photos already there" read at one point.
  For a truly clean test: `adb uninstall com.mmanning.feralspotter` first.
- **Launching via `monkey -c android.intent.category.LAUNCHER` opens Expo Dev
  Launcher's own picker UI**, not the app's JS bundle. Follow it with a deep link to
  actually load Metro's bundle:
  `adb shell am start -a android.intent.action.VIEW -d "exp+feral-spotter://expo-development-client/?url=http%3A%2F%2F<lan-ip>%3A8081"`.
- **Can't view screenshots directly** in this environment (image-file reads are
  blocked). Drove/verified UI instead via
  `adb shell uiautomator dump //sdcard/ui.xml` + `adb pull` + parsing `text=`/
  `content-desc=`/`bounds=` out of the XML, then `adb shell input tap x y` using the
  parsed bounds. Works, but blind coordinate-guessing without checking the dump first
  hit the wrong button more than once (e.g. tapped "New Sighting" instead of the
  actual camera icon — they're visually distinct but both near the middle of the
  home screen).
- **Rapid repeated relaunch/deep-link cycles are themselves crash-inducing** and not
  representative of real usage — produced a transient
  `ReactActivityDelegate.onUserLeaveHint` NullPointerException and a
  `Nitro: javaScriptContextHolder is null` + "missing required default export"
  cascade purely from testing too fast. Always re-verify a suspected crash with one
  single, patiently-spaced interaction before reporting it as a real regression.
- **Port 8081 can be squatted by a stale orphaned `node` process** from a previous
  session's `expo start` that never actually died. `npm run android` will silently
  continue with "Skipping dev server" if it can't bind 8081, leaving the freshly
  installed app with no bundler to talk to. Check
  `netstat -ano | grep ':8081' | grep LISTENING` and kill the stale PID
  (`powershell -Command "Stop-Process -Id <pid> -Force"`) before assuming Metro is
  actually fresh.
- **git-bash mangles device-absolute adb paths** — `adb shell screencap -p
  /sdcard/x.png` gets rewritten to `C:/Program Files/Git/sdcard/x.png` by MSYS path
  conversion. Prefix with `MSYS_NO_PATHCONV=1` or use a doubled leading slash
  (`//sdcard/x.png`) for any `adb shell`/`adb pull`/`adb push` argument that's a
  device path, not a Windows path.
