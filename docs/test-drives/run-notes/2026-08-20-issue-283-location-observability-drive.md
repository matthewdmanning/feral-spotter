# 2026-08-20 — Issue #283 location-observability drive

Git state: branch `issue-283-location-logging` @ ae8ebbc017756a6defbfd88dc50dcb2864829a0d
Device: Pixel 7 (physical, `panther`, arm64-v8a), serial 2A151FDH200HY4

## Goal

Root-cause #283 (`watchPositionAsync` never registers as an OS-level
location listener) using the new `__DEV__` logging from PR #290, since the
original 2026-08-18 session lost its trace to a dead Metro dev-socket.

## Session log

Reconnected worktree `feral-spotter-283-logging` (branch `issue-283-location-logging`
@ `ae8ebbc`) to Metro (already running, `--dev-client`, pid 13868) via the
dev-launcher manual URL entry (`exp://127.0.0.1:8081`) — the auto-discovered
server list never populated over USB, and the "Connect" button stays
`enabled="false"` until the URL field has text, so tapped the field, typed
the URL, then Connect. Confirmed bundle load via `adb logcat`:
```
ReactNativeJS: Running "main" with {"rootTag":1,"initialProps":{},"fabric":true}
ReactNativeJS: [firebase] mode: live
```

Mid-reconnect the physical device dropped off USB entirely (`adb devices`
empty even after `adb kill-server`/`start-server`) — cable/port issue, not
adb state. Reseated cable, device came back, re-ran `adb reverse` + relaunch.

Walked onboarding -> data agreement -> camera permission (while using app)
-> location permission (Precise, while using app) -> location-access info
dialog -> sign-in screen -> tapped "Continue with Google" -> picked
`mattmanningclemson@gmail.com` from the native account chooser ->
**"Sign-in failed / Something went wrong signing in. Please try again."**

Drive stopped here — sign-in blocks all further screens (camera, location
permission consumption, the actual #283 repro).
