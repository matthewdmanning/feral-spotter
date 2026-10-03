# 2026-08-09 — Physical-device monitoring tooling

Closes #201.

## What shipped

1. **`scripts/device-monitor.sh`** (also `npm run device-monitor`): resolves
   the app's pid (`adb shell pidof com.mmanning.feralspotter`), streams
   pid-scoped `ReactNativeJS`/`AndroidRuntime`/`System.err` plus
   package-scoped `ActivityManager` logcat lines, and automatically
   re-resolves the pid after an app restart.
2. **Screen-transition logging** — decided in favor of a thin
   `usePathname()` wrapper (`ScreenTransitionLogger` in
   `src/providers/AppProviders.tsx`), mounted unconditionally in dev
   builds. Logs `[nav] <pathname>` on every route change. Chosen over
   wiring existing analytics calls to also log in dev: no per-call-site
   changes needed, covers every route rather than only ones with an
   existing analytics event, and it's local-only (no network, no PII) so
   it doesn't need to be gated behind consent.
3. **Recipe documented** in `docs/agents/test-driving.md`.

## Folded in from this session's own findings (see ticket)

- `[analytics] disabled — EXPO_PUBLIC_POSTHOG_KEY not set` now logs on
  startup in dev builds when the key is missing (`AppProviders.tsx`) —
  previously this silently voided every analytics test-drive check with
  no signal.
- `src/lib/location.ts`'s `startLocationCapture()` now logs
  `[location]`-tagged lines at each of its exit points (already-pending
  no-op, no-consent early return, permission-not-granted early return,
  `watchPositionAsync` start, and the catch around it) — previously all
  silent, making it impossible to tell "never called" from "early
  returned" from "threw" by observing from outside.
- Fixed a stale claim in `test-driving.md`: JS `console.*` output
  (`[analytics]`/`[location]`/`[nav]`) does not reliably reach `adb
logcat`'s `ReactNativeJS` tag on this project — it must be read from
  Metro's JSONL log (`.expo/dev/logs/start.log`) instead. `device-monitor.sh`
  is for native/system signals only (crashes, stderr, app lifecycle).

## Tests

No new test files — this is dev-only logging/tooling, not business logic
(per `testing.md`, no `tdd` needed for this ticket). Existing
`src/lib/__tests__/location.test.ts` and `location.model.test.ts` still
pass unchanged (new logging is `__DEV__`-gated and side-effect-free).

## Verification

- `npx jest src/lib/__tests__/location` — pass (7/7).
- `npx tsc --noEmit` — clean.
- `npx eslint` on touched TS files — clean.
- `bash -n scripts/device-monitor.sh` — syntax OK.
- Not device-tested this session (no physical device in this
  environment) — the script itself, the `[location]`/`[nav]` log
  visibility in Metro's JSONL log, and the POSTHOG_KEY-missing banner are
  all unverified live and should be confirmed on the next physical-device
  test drive.
