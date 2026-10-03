# #201 — Physical-device monitoring tooling

[GitHub issue #201](https://github.com/matthewdmanning/feral-spotter/issues/201) · label `chore` · common context: [README](README.md)

## Status: open, unimplemented, scope confirmed and sharpened

None of the three original asks exist yet (checked 2026-08-09): no
`scripts/device-monitor.sh`, no screen-transition-logging decision, no
recipe documented in `docs/agents/`.

Two concrete instances found this session, worth folding into the same fix
rather than filing separately:

## Instance 1 — missing `POSTHOG_KEY` is silently unobservable

`EXPO_PUBLIC_POSTHOG_KEY` being unset voids every analytics-related
test-drive check (blocks [#197](not-ready/197-analytics-consent-race.md) entirely)
and nothing surfaces this — you only find out by reading source and doing
timing analysis on a warning message. **Suggested addition to this
ticket's scope:** a startup-time dev-mode log or on-screen banner —
"analytics disabled — POSTHOG_KEY not set" — so a future test-drive session
doesn't spend time chasing a false signal the way this session did.

## Instance 2 — `src/lib/location.ts` has three silent failure paths

`startLocationCapture()` (`src/lib/location.ts:96-146`) has zero logging
across all its exit points: `hasAcceptedConsent()` early-return,
permission-status early-return, and a bare `try/catch { resolve() }`
around `Location.watchPositionAsync`. This session tried to confirm GPS
capture fires (mandatory every-run check per
[test-driving.md](../../agents/test-driving.md)) and could not — logcat,
`dumpsys location`, and Metro's JSONL log all came back empty for the app's
package despite permissions genuinely granted (`ACCESS_FINE_LOCATION: granted=true`)
and device location services on (`location_mode=3`). Could not distinguish
"never called," "early-returned," or "threw" from outside — all three look
identical: silence. **Suggested addition to scope:** minimal dev-only
`[location]`-tagged logging at each of those 4 exit points.

## Also found: stale doc reference

`test-driving.md`'s mandatory-check wording says to check _logcat_ for
`[analytics]`/`captureEvent(`/etc., but that data only ever reaches
Metro's JSONL log (`.expo/dev/logs/start.log`), never logcat. Fix when this
ticket's documentation ask (item 3, "document the recipe") gets done — see
[documentation.md](../../agents/documentation.md) for where that belongs.

## Suggested skills

- No `tdd` needed — this is tooling/logging, not app business logic.
