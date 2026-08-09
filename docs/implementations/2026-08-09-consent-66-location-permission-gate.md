# Consent — #66 location permission gate (Don't-allow bypass) (2026-08-09)

Implements #66. Branch `issue-66-location-permission-gate`, off fresh
`origin/main` (`780da4606c396fbdb5fbe7752c189a72aedbfe1a`).

## What shipped

`src/screens/consent/index.tsx`'s permission gate only treated
`RESULTS.BLOCKED` as gated. `react-native-permissions` reports a first-time
full "Don't allow" as `RESULTS.DENIED`, not `BLOCKED` — Android only
escalates to `BLOCKED` on a second denial (or "don't ask again") — so a
first-time full denial fell through the gate and proceeded exactly like a
full grant.

Added `isLocationGated(status)` (gates on `BLOCKED` or `DENIED`) and used it
for location's status in both places that decide the gate: the post-`request`
check in `handleAgree`, and the foreground-recheck effect that clears the
gate after the user grants access from system Settings. The recheck effect
needed the same fix, not just the initial check — before this change it
cleared the gate on any status `!== BLOCKED`, which would have incorrectly
cleared a still-`DENIED` gate on a plain app foreground with no Settings
visit at all.

Camera's status check is unchanged (`BLOCKED` only) — the camera-consent
sub-thread on #66 was already confirmed resolved and is out of scope here.

Per the device-tested sweep on #66: Precise (either time-scope) and
Approximate both keep their existing, already-correct behavior (proceed /
stay gated respectively) — only the Don't-allow path changes.

## Tests written

`src/screens/consent/__tests__/ConsentScreen.locationGate.model.test.tsx` —
new `xstate`/`@xstate/graph` model (`testing.md` model-based-tests policy)
covering the location-status → gate mapping, camera held `GRANTED`
throughout since it's out of scope:

- full precise grant proceeds straight to `/sign-in`
- Approximate (`BLOCKED` on first request) stays gated — regression guard
  for the already-correct path
- first-time Don't allow (`DENIED`) is gated, not passed through — the #66
  fix itself
- Don't allow, backgrounded without visiting Settings, stays gated — guards
  the foreground-recheck fix specifically
- Don't allow, then granted in Settings, gate clears to `/sign-in`

Existing `ConsentScreen.test.tsx` (decline flow, blocked-permission
Settings-recovery) left as-is; unaffected by this change.

## Verification status

Gates run and passing: `jest src/screens/consent` (2 suites / 9 tests),
`tsc --noEmit` (project-wide, clean), `expo lint` (0 errors; pre-existing
require()-in-tests warnings only, none in touched files).

**Not run on-device** — this is a JS-only status-branching fix; the sweep
in #66 that identified the bug was already device-tested and is not
re-verified here per the ticket's own instruction not to re-run it.

## 2026-08-09 — extension

**Purpose:** #232 — found while syncing `docs/planning/2026-07-27-onboarding-registration-consent-fsm.md` against this fix. `isLocationGated()` covered `BLOCKED`/`DENIED` but not `UNAVAILABLE` (the permission/feature doesn't exist on this device) — a Submission can't get a real location in that case either, so it should gate the same way.

**Change:** `isLocationGated()` now also gates on `RESULTS.UNAVAILABLE`.
`ConsentScreen.locationGate.model.test.tsx` wires `UNAVAILABLE` into the
machine as `gated` (`AGREE_UNAVAILABLE`, `FOREGROUND_STILL_UNAVAILABLE`),
and adds dedicated journeys for `LIMITED` (an iOS partial-access concept,
not applicable to Android's `ACCESS_FINE_LOCATION` — does not gate, same
as `GRANTED`) — no standalone `UNAVAILABLE`/`BLOCKED` journeys, since both
land on the same `gated` state `DENIED` already exercises.

Also fixed unrelated drift in the FSM planning doc, independent of this
gating change: it still described a 3-permission `request()` sequence
(camera/media/location — code only requests camera + location, #91 made
photo-library access lazy) and a "Continue Without Access" blocked-gate
button removed same-day by #215.

Verification: `npx jest src/screens/consent` (2 suites / 11 tests) pass,
`npx tsc --noEmit` clean, `npx eslint`/`npx prettier --check` clean on
touched files. Not device-tested (no physical device in this environment).

## 2026-08-09 — fix: camera had the same untested DENIED gap (#237)

**Purpose:** advisor review of a separate relaunch-bypass follow-up to #66
(deferring `markAccepted()` until the gate check clears — tracked on its
own branch/PR, not part of this file's history since it doesn't touch
gating logic) also flagged that `cameraStatus === RESULTS.BLOCKED` was
never updated alongside location's gating — camera's first-time "Don't
allow" has the identical DENIED-not-BLOCKED asymmetry #66 fixed for
location, just untested and unfixed for camera. #66's older camera
sub-thread only ever confirmed camera _grants_, never a denial, and every
model journey up to this point pinned camera to `GRANTED`, so nothing could
see the gap. Filed and fixed as #237.

**Change:** `isLocationGated()` renamed to `isPermissionGated()` and applied
to both `cameraStatus` and `locationStatus` in `handleAgree`'s gate check
and the foreground-recheck effect — same `BLOCKED`/`DENIED`/`UNAVAILABLE`
rule for both permissions now.

Tests: new `ConsentScreen.cameraGate.model.test.tsx`, mirroring the
location model but scoped to camera's status (location held `GRANTED`
throughout) — full grant, BLOCKED (regression guard), first-time DENIED
(the fix), DENIED surviving a plain foreground, DENIED clearing via
Settings, and UNAVAILABLE. No LIMITED journey — not a real outcome for the
`CAMERA` permission. Updated `ConsentScreen.locationGate.model.test.tsx`'s
doc comment to point at the new file instead of the stale "camera
sub-thread resolved" note.

Also synced `docs/planning/2026-07-27-onboarding-registration-consent-fsm.md`
again — it documented "camera gates only on BLOCKED" as the intentional
rule; updated to reflect both permissions sharing `isPermissionGated()`.

Verified: `jest src/screens/consent` (3 suites / 17 tests), `tsc --noEmit`,
`expo lint` (0 errors). Not run on-device — same rationale as above; no new
permission-status branching beyond what #226 already device-verified for
the identical BLOCKED/DENIED logic, now just applied to a second field.
