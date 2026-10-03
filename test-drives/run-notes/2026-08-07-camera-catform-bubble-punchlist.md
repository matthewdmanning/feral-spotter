# Test drive — 2026-08-07 (Camera / Cat Form / bubble punchlist)

Git state: branch `issue-163-first-run-reorder`, commit `4e9208a4eafea3891a83304800386b1dce865eaf`.
Device: physical Pixel 7 (`panther`, serial `2A151FDH200HY4`), debug build (`android/app/build/outputs/apk/debug/app-debug.apk`, installed via `adb install -r`, existing app data retained — not a fresh-install session).
Logs captured: `docs/test-drives/logs/2026-08-07-punchlist-drive-full.log` (full `adb logcat -d` dump, 14,124 lines) and Metro terminal output for this session.

## User observations

Reported live during the drive, source: `docs/test-drives/temp-punchlist.md`. Verbatim content reformatted per-screen; wording otherwise unchanged.

### Camera screen

- Back button undoes boxing — should instead display the box selection (i.e. return to a state showing the box already drawn, not discard it).
- "Not in Photo" button does not work for the first or last photo, but works for other photos.
- "Not in Photo" also fails for the first photo specifically after the user hits Confirm then Back on the next screen.
- Bubble sits at the bottom of the screen, obscuring buttons — should be at the top.
- Bubble is sometimes off-screen entirely.
- Box gestures work, but the user can drag a box far enough that it becomes invisible/off-canvas.
- No "Not in photo" gesture — this may be a dropped feature.

### Cat Form screen

- Still initializes with Unknown/Unsure buttons pre-selected.
- Bottom button still labeled "Put the Cat in a Box" (stale label).
- Warning popup text is poorly formatted — flagged as needing a corresponding update to `docs/references/ux_principles.md`.
- "Put the Cat in a Box" button is wired back to the Camera screen — it should go to the Cat List screen instead. ("Done" button correctly goes to Cat List, as expected.)
- Header does not resize when the bubble shrinks (collapses).
- Bubble disappears off-screen on this screen too.
- Bubble begins maximized on both screens — should begin small (collapsed).
- On the second cat's form specifically, "Put the Cat in a Box" goes to the Cat List screen (inconsistent with the first cat form, where the same button goes to Camera — see above).

## Agent observations (from logs)

Pulled from `docs/test-drives/logs/2026-08-07-punchlist-drive-full.log` (native `adb logcat`) and the live Metro terminal for this session. These are what the logs show, not independent confirmation of the user-reported bugs above — logcat doesn't surface RN Navigation's internal route state, so it can't directly verify claims like "wired back to the wrong screen."

- **No crash.** No `FATAL`, `AndroidRuntime` crash, or JS exception/red-box anywhere in either log for the session window.
- **`ReactNativeJS` tag absent from logcat entirely** (0 matches across all 14,124 lines) — this build's JS console output isn't routed through the native logcat channel at all; it only appears in the Metro terminal (dev-client + Metro websocket connection). Logcat alone is _not_ sufficient to audit JS-side behavior for this build — future drives should capture the Metro terminal output too, not just `adb logcat`.
- **Unistyles warning, 29 occurrences during the session:**
  ```
  WARN  Unistyles: we detected style object with 2 unistyles styles. This might cause no updates or unpredictable behavior. Please check style prop for "View" and use array syntax instead of object syntax.
  ```
  Fired repeatedly, consistent with a component re-rendering many times with an object-style prop unistyles expects as an array. Given the library's own wording ("unpredictable behavior"), and that several user-reported bugs above are specifically rendering/positioning issues on the bubble and header (off-screen bubble, header not resizing on collapse) — this is a plausible lead worth checking first, not a confirmed root cause. Component/file not identified from the log alone.
- **`[analytics] capturer not registered — call registerCapture() in a PostHog-wrapped component`, 4 occurrences.** Not on the user's punchlist. Worth a follow-up look against the project's "every emulator run" analytics-consent check (`docs/agents/project_instructions.md`) — this warning implies an analytics call was attempted without a registered capturer at least 4 times during the session; unclear from the log alone whether that's benign (e.g. an early-mount race) or a real gap.
- **Native logcat shows only OS-level navigation/window churn** (`CoreBackPreview` back-callback set/cleared, `WindowManager` surface changes) at times consistent with the user's reported screen transitions, but carries no route-name information — can't be used to independently confirm _which_ screen was entered on any given transition.
- Buffer was heavily dominated by unrelated Pixel/system-service noise (Finsky/Play Store, GMS Auth, telephony, thermal) — a physical device's logcat is much noisier than the emulator's; on-device drives going forward should grep/filter early rather than eyeballing the raw dump.

## Follow-up

- Not triaged into issues yet — this is a raw capture of the drive. Punchlist items above need the usual triage pass (issue creation, `wayfinder`/label assignment) before they're actionable.
- Re-run this drive after a `pm clear` for a true first-run session if `docs/design-decisions/first-run-flow-order.md` (#162/#163) also needs on-device verification — this session's install retained prior app data (existing auth session + consent), so the first-run reorder was **not** exercised here at all.
