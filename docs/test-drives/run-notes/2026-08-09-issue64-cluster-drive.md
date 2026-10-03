# Test drive: issue #64 cluster (2026-08-09)

Device: Pixel 7 (physical, USB)
App checkout under test: `C:\GitHub\feral-spotter`, branch `main`, commit `780da4606c396fbdb5fbe7752c189a72aedbfe1a`
Build: debug, installed via `expo run:android`, Metro running with `CI=1` (reloads disabled)
Note: `EXPO_PUBLIC_AUTH_MOCK=true` — auth is mocked, not production behavior, for any step touching sign-in/profile.
Evidence channels: pid-scoped logcat (`docs/test-drives/logs/2026-08-09-135014-issue64-drive.log`, pid 30795), `uiautomator dump` for screen-level state (not `dumpsys activity` — see #66 history for why that's unreliable), Metro JSONL log (`.expo/dev/logs/start.log`) for `[analytics]` events.

## #98 — hardware back on intro-flow T1

**Steps:** `pm clear` app data (fresh install state) → launch → confirm on T1 ("Every feral counts") via uiautomator dump → hardware back.

**Result:** App backgrounds cleanly to launcher (`mFocusedApp` → `NexusLauncherActivity`). Process stays alive (pid unchanged, 30795) — not killed, not crashed. No exceptions in pid-scoped logcat around the event (log empty for this window). Relaunching (`am start -n .../.MainActivity`) returns cleanly to T1, no blank/broken residual state.

**Verdict:** Not a crash, not a blank screen. Matches one of #98's two acceptable outcomes ("let it exit the app intentionally"). Whether a confirm-exit prompt is still wanted for UX (avoid accidental-back data loss — though nothing is entered yet at T1) is a product call, not a bug fix. Leaving open for that decision rather than closing.

## #66 — Approximate-location gate, re-confirmed (2nd `pm clear` pass, pid 31751)

**Steps:** fresh install → intro-flow → data agreement → camera permission "While using the app" → location permission: selected "Approximate", then "While using the app".

**Result:** Landed on "Permission Blocked" gate ("Camera, photo, or location access was denied..."), same as the already-documented root cause (app checks `ACCESS_FINE_LOCATION` specifically; Approximate only grants `ACCESS_COARSE_LOCATION`). Still unfixed, reproduces exactly as designed in the 2026-08-02 comment thread. No new information — confirms the bug is still live, not yet a regression risk from other work this session.

**Next pass (3rd `pm clear`):** chose "Precise" instead to get past the gate and continue the drive. Precise + While-using-the-app proceeds normally to sign-in.

## #66 — full location-permission combination sweep (5 fresh `pm clear` passes)

Systematic sweep of every reachable option on the location system dialog (accuracy × grant-type), camera held constant at "While using the app" each pass so only the location variable changes. Each pass: fresh `pm clear` → intro-flow → data agreement → camera grant → location dialog → observe.

| Accuracy    | Grant type                | Result                           |
| ----------- | ------------------------- | -------------------------------- |
| Precise     | While using the app       | passes normally, reaches sign-in |
| Precise     | Only this time            | passes normally, reaches sign-in |
| Approximate | While using the app       | **Permission Blocked gate**      |
| Approximate | Only this time            | **Permission Blocked gate**      |
| n/a         | Don't allow (full denial) | passes normally, reaches sign-in |

**Finding — this is backwards, and worth calling out explicitly:** full denial ("Don't allow") passes through fine, but the _lesser_ grant ("Approximate") — which a reasonable user would read as "yes, use my location, just not exact" — is the one that gets blocked. Full denial is very likely reported as `DENIED` (not `BLOCKED`) by `react-native-permissions` on a first-ever ask (Android typically needs a second denial or a "don't ask again" tick before reporting `BLOCKED`), while the FINE-check-fails-but-COARSE-granted combination apparently reads as `BLOCKED` to the library. If the app's gate only triggers on `BLOCKED` (matching the already-identified root cause: checks `ACCESS_FINE_LOCATION` specifically), that would explain both halves of this table at once — worth confirming against `src/lib/permissions.ts`'s exact status-mapping when implementing the fix, not just patching the Approximate case in isolation.

This also means the 2026-08-02 requirement's second half — "an actual denial should route the user back to Home, not the blocked-gate screen" — already holds today, just apparently by accident of `DENIED` vs `BLOCKED` classification rather than intentional handling. Worth keeping that behavior intentional (not regressing it) when the Approximate case gets fixed.

**Requirement correction (2026-08-09, Matthew) — supersedes the above framing.** "Don't allow" passing through ungated is the actual critical bug, not a benign side effect — the whole point of the gate is to prevent exactly that path. Corrected target behavior:

- Precise (either time-scope): proceed normally.
- Only this time: proceed, but show a convenience-tradeoff warning (re-prompted each session) — still no gate.
- Approximate: should be gated, or better, only offer Precise as a selectable option at all.
- Don't allow: must be gated. This is the fix priority.

Fix needs to gate on `DENIED`, not just `BLOCKED` — `react-native-permissions` reports a first-time "Don't allow" as `DENIED`, which the current `BLOCKED`-only check doesn't catch.

## #208 — supporting evidence (not yet implemented, ready-for-agent)

"Before You Start" data-agreement screen text reads _"Your Google account so we can follow up..."_ — implies Google is the only sign-in method, matching #208's exact complaint. Confirms the described bug is real and current (screen not yet fixed). The actual sign-in screen, once reached, does show all four methods (Email/Password, Google, Apple "coming soon", Facebook "coming soon") — so the mismatch is specifically in this one screen's copy, not systemic.

## #197 / mandatory analytics check / #201 — `POSTHOG_KEY` not configured in this dev environment

**What I intended to test:** #197's race (`handleContinue` flips consent + navigates synchronously; `PostHogProvider`/`AnalyticsBridge` registers the real capturer in a later effect — a window where `captureEvent` calls silently drop). Also the mandatory every-run check ("PostHog only fires with consent").

**What actually happened:** Accepted analytics consent (default-checked) on the "One more thing" screen — no synchronous capture call in `handleContinue` (code-confirmed, `src/screens/analytics-consent/index.tsx`), so nothing was in flight to drop; 0 new `[analytics]` lines in Metro's log at that transition, but this is not a meaningful negative result. Then opened the Camera screen (mounts `CAMERA_OPENED` via `captureEvent`, `src/hooks/useCameraCapture.tsx:218`) — several seconds and 4 screen transitions after the consent tap. Got: `"[analytics] capturer not registered — call registerCapture() in a PostHog-wrapped component"`.

**Root cause of that warning:** the delay (seconds, multiple screens) is inconsistent with a millisecond registration race — the only explanation is the capturer is _never_ registered. Checked the gate: `src/providers/AppProviders.tsx:72-86` mounts `PostHogProvider` only if `IS_PRERELEASE && POSTHOG_KEY && ...`. `IS_PRERELEASE` is `true` here (`__DEV__`). `POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY`, which is **not set** — `.env` is empty (0 bytes), `.env.local` has no `POSTHOG` entry, no `.env.example` exists. `PostHogProvider` never mounts in this environment regardless of consent state.

**Consequences:**

- **#197: cannot be tested in this environment, full stop.** The discriminating observation (a `captureEvent` call landing exactly inside the remount window) needs a real `POSTHOG_KEY`, a clean install, 0 cached submissions (to rule out the `useFeralReports` per-cache-file mount-effect as the source), and an event that fires synchronously at/right after the consent-accept navigation. None of that is producible here. This likely also explains #197's _original_ filing — same dev machine, probably same missing key, so the 4 warnings that motivated filing it may not have been evidence of the race either. The ordering bug in `handleContinue` (sync store flip → immediate `router.replace`, capturer registered in a later effect) is still real by source inspection — just unproven by device observation, here or (probably) originally.
- **Mandatory every-run analytics check: NOT VERIFIABLE this run, not a pass.** With no key, the provider never mounts whether consent is checked or unchecked — the check is vacuously satisfied and proves nothing about consent gating. Also worth noting for whoever owns `test-driving.md`: it says to check logcat for `[analytics]`/`captureEvent(`/etc., but that data only reaches Metro's JSONL log (`.expo/dev/logs/start.log`), never logcat — the check as currently written is unrunnable as specified, independent of the key issue.
- **#201:** this is a concrete instance of the observability gap #201 already asks to fix (no repeatable, documented physical-device monitoring setup) — specifically, nothing surfaces "PostHog is unconfigured, all analytics assertions in this run are void" without reading source. Filing this as a #201 comment, not a new issue.

## GPS / Live-fix capture — unconfirmed, possible real gap (needs follow-up)

**Attempted:** mandatory every-run check that GPS capture fires (`startLocationCapture`/`FusedLocationProvider`/`GnssLocationProvider`/`watchPositionAsync` per `test-driving.md`). Opened Camera screen (confirmed via `uiautomator dump`: `SurfaceView` + SVG shutter controls, on-screen after "Take a Photo" tap) — `useCameraCapture.tsx:218-224` calls `startLocationCapture()` unconditionally on mount.

**Checked, all negative:**

- Unfiltered logcat (`-t 3000`, then `-t 5000`, case-insensitive `location|gps|Fused`): no line attributable to our package. Saw unrelated `com.google.android.gms` "SemanticLocation" noise (a different, pre-existing system feature) and nothing else.
- Metro JSONL log: zero `[location]`-tagged lines in the entire session (this tag doesn't appear to exist in the source at all — grepped `src/` for it, no match — so this channel was never going to show anything regardless).
- `adb shell dumpsys location`: no registered client for `com.mmanning.feralspotter`, no request history for our package today (only yesterday's unrelated `com.google.android.gms`/Maps entries).
- Permissions genuinely granted: `dumpsys package com.mmanning.feralspotter` shows `ACCESS_FINE_LOCATION: granted=true`, `ACCESS_COARSE_LOCATION: granted=true`.
- Device location services: `location_mode=3` (High accuracy), enabled system-wide.

**Why this is inconclusive rather than a confirmed bug:** `startLocationCapture()` (`src/lib/location.ts:96-146`) has a bare `try { await Location.watchPositionAsync(...) } catch { resolve() }` — any failure inside is swallowed with zero logging, and the two early-return guards above it (`hasAcceptedConsent()`, `getForegroundPermissionsAsync()` status check) also return silently with no logging. From outside the app there is no way to distinguish "never called," "early-returned on a consent/permission check that reads differently than `dumpsys` shows," and "threw and hit the catch" — all three look identical: silence.

**Recommendation:** don't file this as a confirmed bug against an app-behavior issue. It's a diagnostics gap (zero observability into a background task with three silent failure paths) that happens to also block confirming the mandatory GPS check. Fits #201's ask directly. Flagging to Matthew for a call on whether to add minimal `[location]`-tagged logging (dev-only) before spending more device time chasing this blind.

## #66 — media-consent "Don't allow" exit, attempted, not reproduced

**Tried:** opening Camera screen, pressing shutter (first photo save), and "Choose from Library" from Home — looking for the photos/media permission dialog described in the 2026-08-03 comment.

**Result:** no photos/media permission dialog appeared via any of the three paths. Android's Photo Picker (used by `expo-image-picker` here) doesn't require `READ_MEDIA_IMAGES` for user-selected access, and add-only gallery writes don't need a runtime prompt under this OS version's scoped storage. Permissions came back already effectively usable without a prompt.

**Caveat:** could not confirm these are the exact original repro steps — the source doc (`docs/design/2026-08-02-ui-bug-punchlist.md`, item 9, cited by #66's 2026-08-03 comment) is not present in either the main checkout or this session's worktree. Commented on #66 asking for the file or exact steps if still needed.

## #157 — Resume Submission trigger + prominence

**Steps:** built up an in-progress submission (camera capture → Box Annotation → "Boxing Complete"), returned to Home.

**Result — trigger:** "Resume Submission" appeared correctly alongside "New Sighting", confirmed via `uiautomator dump` (not `dumpsys activity`). Not broken.

**Result — prominence** (bounds on 1080×2400 screen):

- "Take a Photo": y 695–773
- "Choose from Library": y 1542–1620
- "Resume Submission": y 1937–2007
- "New Sighting": y 2098–2168

All four on-screen without scrolling, but "Resume Submission" is 3rd from top — below both fresh-capture entry points. Plausible discoverability explanation consistent with the original report: trigger and existence are fine, positioning de-emphasizes it relative to "start new." Visual styling (color/weight) not evaluated — would need a screenshot, not taken this session.

## #76 — photo timestamps, capture + local cache stages (both entry paths)

**Camera path:** captured a photo; pulled `cache/VisionCamera_*.jpg` from app-private storage via `adb exec-out run-as com.mmanning.feralspotter cat <path>` (plain `adb shell ... cat` corrupts binary output on Windows — text-mode CRLF translation). EXIF: `DateTimeOriginal = 2026:08:09 14:13:11`, correct. Submission cache (`RKStorage` AsyncStorage SQLite DB, key `submission_cache_<id>`) records `metadata.time_method: "device"`.

**Library Pick path:** picked a pre-existing gallery photo ("Aug 8, 2026 5:23 PM"). Submission cache: `metadata.time_method: "device"`, `metadata.captured_at: "2026-08-08T21:23:18.000Z"` — matches the photo's real date. Timestamp correctly threaded through.

**Not covered:** the Manual-time fallback path (Library pick of a photo with no EXIF timestamp — needs a fixture photo, none available on this device) and the upload stage (server-side receipt).

**Verdict:** capture → local cache verified working for both paths tested. Manual-time fallback and upload stage need a separate pass.

## Extraction technique notes (for future device drives)

- **Screen state:** `adb shell uiautomator dump /sdcard/window_dump.xml` + `adb pull` (use `MSYS_NO_PATHCONV=1` in git-bash or the leading `/sdcard/...` gets mangled into a Windows path). Parse `text="..."` and `content-desc="..."` attributes; get tap coordinates from the nearest `bounds="[x1,y1][x2,y2]"` and tap the center — don't trust `emulator/tap_text.py`'s clickable-ancestor heuristic on permission dialogs and native pickers, it repeatedly picked the wrong ancestor there; raw coordinate taps from `bounds` were reliable throughout.
- **App-private files:** `adb shell run-as <pkg> find/ls` to locate; `adb exec-out run-as <pkg> cat <path>` (not `adb shell ... cat`) to pull binary files without corruption.
- **AsyncStorage:** lives at `databases/RKStorage`, a SQLite DB, table `catalystLocalStorage`, columns `key`/`value`. Submission cache is `submission_cache_<uuid>` (JSON value), pointed to by `submission_cache_current`.
- **MMKV** (`files/mmkv/feralspotter`): binary format, not plain-text-greppable; didn't find a quick read path this session — the consent/UI stores checked here turned out to live in AsyncStorage instead, not MMKV.
