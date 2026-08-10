# #66 — Location permission gate (Don't-allow bypass)

[GitHub issue #66](https://github.com/matthewdmanning/feral-spotter/issues/66) · label `ready-for-agent` · common context: [README](README.md)

## The actual bug (corrected 2026-08-09 — read this before the older comments)

Full location-denial ("Don't allow") currently bypasses the permission gate
entirely and proceeds straight to the rest of onboarding — same as a full
grant. **This is the critical bug.** The gate exists specifically to prevent
that path. Earlier comments on this issue focus on the Approximate-accuracy
case; that framing is superseded, see the full sweep below.

Older sub-thread on this issue (camera-consent, 2026-08-02) is resolved —
camera "While using"/"Only this time" both correctly grant. Don't spend time
re-verifying that part.

## Confirmed by a full combination sweep (device-tested, don't re-run)

| Accuracy    | Grant type          | Result                                                    |
| ----------- | ------------------- | --------------------------------------------------------- |
| Precise     | While using the app | passes normally                                           |
| Precise     | Only this time      | passes normally                                           |
| Approximate | While using the app | **Permission Blocked gate** (correct — should stay gated) |
| Approximate | Only this time      | **Permission Blocked gate** (correct — should stay gated) |
| n/a         | Don't allow         | **passes normally — this is the bug**                     |

## Root cause (identified, not yet fixed)

`src/lib/permissions.ts` maps `location` to `PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION`
specifically. The gate almost certainly only triggers on a `BLOCKED` status
from `react-native-permissions`. A first-time "Don't allow" reports as
`DENIED`, not `BLOCKED` (Android generally needs a second denial or "don't
ask again" before reporting `BLOCKED`) — so the gate's `BLOCKED`-only check
never sees it. The Approximate case apparently _does_ read as `BLOCKED`
(FINE denied, COARSE granted), which is why it correctly gates today.

**Fix:** gate on `DENIED` as well as `BLOCKED`, not just `BLOCKED`. Find the
exact status-check call site (search for the `BLOCKED` comparison near the
location-permission handling — likely in or near the consent screen /
wherever "Permission Blocked" gets rendered) and confirm the fix doesn't
regress the fact that the sweep above shows full-grant paths must keep
passing.

## Target behavior per grant type (confirmed with Matthew, don't re-derive)

- Precise (either time-scope): proceed normally. No change needed.
- Only this time: proceed, but show a convenience-tradeoff warning (re-prompted every session) — split into [#225](225-only-this-time-warning.md), no gate.
- Approximate: stays gated (already correct).
- Don't allow: must be gated. **This is the fix.**

## A dead end already ruled out

"Only offer Precise as an option" (to sidestep Approximate entirely) is
**not achievable** — Android 12+ always shows the Precise/Approximate
toggle whenever `ACCESS_FINE_LOCATION` is requested, auto-adding
`ACCESS_COARSE_LOCATION` if not declared. No manifest flag or runtime API
suppresses this. Don't attempt it.

## Suggested skills

- `tdd` — model this as a permission-state machine per
  [testing.md](../../agents/testing.md) (states: `granted-fine`,
  `granted-coarse`, `denied`, `blocked` × time-scope) rather than
  hand-written per-case tests. `getPathsFromEvents` for the real user
  journey, not just `getShortestPaths` coverage.
