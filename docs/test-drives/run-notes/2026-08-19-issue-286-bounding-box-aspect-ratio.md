# Test Drive: Annotation UI (2026-08-19)

Git state: `6a29006b8d59abfa9db563e44b294bf51abbb311` on branch
`issue-286-bounding-box-aspect-ratio`. Uncommitted working-tree changes
present at run time: `src/components/organisms/AnnotateCarouselItem.styles.ts`,
`src/components/organisms/AnnotateCarouselItem.tsx`,
`src/hooks/useBoundingBoxFrame.ts` (modified), plus new
`src/lib/annotate/boxResize.ts` + `boxResize.test.ts` (untracked) — issue
#286's aspect-ratio handle work.

Device: physical Pixel 7, `2A151FDH200HY4`. Prebuilt native app
(`com.mmanning.feralspotter`), Metro dev-client.

Scope: annotation UI (Annotate screen, Cat Form / Edit Cat screen).
Submission was hit incidentally during the run but is out of scope for
this drive.

## Setup notes

Metro was already running on port 8081 but wedged (24h-old process,
PID 19408, stale `CLOSE_WAIT` connections, accepted TCP but never
answered `/status`) — dev client spun indefinitely trying to connect.
Killed the stale process and started a fresh `npx expo start
--dev-client`; confirmed healthy via `curl http://127.0.0.1:8081/status`
(200 OK) before relaunching the app. `adb reverse tcp:8081 tcp:8081` was
also required after the fresh launch (dev-client deep link:
`feralspotter://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`).
Bundle loaded clean afterward (4475 modules, `Running "main"` /
`[firebase] mode: live` in `ReactNativeJS`, no `FATAL EXCEPTION`).

## Every-run checklist (test-driving.md)

- **PostHog consent-gated firing**: analytics events fired throughout the
  session (`library_photos_selected`, `cat_boxing_completed`,
  `cat_observation_saved`, app active/backgrounded), confirmed via
  `.expo/dev/logs/start.log`'s `metro:client_log` entries, consistent with
  consent already granted. Did **not** retest the unchecked-consent case
  (no `PostHogProvider` mount) this session.
- **GPS/location capture**: no `startLocationCapture`, `[location]`,
  `FusedLocationProvider`, `GnssLocationProvider`,
  `LocationManagerService`, or `watchPositionAsync` lines anywhere in
  `logcat` for the session. Consistent with issue #283 (location request
  never reaches Android's location manager) — not independently
  re-diagnosed here, just noted as still reproducing.

## Findings

See `docs/test-drives/temp-punchlist.md`, "Punchlist 2026-08-19" section,
for the full list. Summary:

- Clear button on Edit Cat screen does nothing.
- Inset crop bubble missing for the second cat on Annotate; on Observed
  Cat screen it's undersized minimized / oversized (screen-width) maximized.
- Resize handles sit on box corners/ends instead of the spec'd halfway
  points on the crosshair arms.
- Pinch no longer zooms the photo (regression from prior behavior) —
  makes boxing distant cats hard. Pinch/pan should move the photo; the
  handles alone should control box dimensions.
- TODOs logged: Delete button on Edit Cat (removes cat + its
  annotations from Cat List), bigger/configurable handle hitbox (+50%),
  rename "Boxing Complete" to "Done With This Cat".
- Submission Failed popup hit once mid-session (out of scope for this
  drive) — logged to the punchlist for later triage.

## Logs

Full session `logcat` dump: `docs/test-drives/logs/2026-08-19-annotation-ui-drive-logcat.log`.
