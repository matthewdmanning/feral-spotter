# Sprint:cats — #149 relabel "Done" to "Finished!", disable when empty (2026-08-03)

Implements #149, part of #148 (Cat Observations sprint), per grilled
decisions in `docs/sprint_planning/2026-08-03-sprint-cat-observations-149-153-grill-decisions.md`.
Branch `issue-144-camera`. Code complete.

## What shipped

`create/index.tsx` (Submission Details screen) — same final-submit button
that #130 already moved off the old Cat Observations screen; the
issue's original "Cat Observations screen" wording was stale, confirmed
by reading the current file before touching anything.

- Label changed `Done` → `Finished!` (`doneBtnText`, unchanged style).
- Button now `disabled={cats.length === 0}` and visually dimmed via a new
  `doneBtnDisabled` style (`opacity: 0.4`) applied conditionally — grilled
  decision was "render disabled", not hide, so a user with zero cats still
  sees the button and understands why it won't respond.

## Reasoning

Disabled-not-hidden was the explicit grilled answer: hiding the button
would remove the user's landmark for "this is how I finish," which is
worse than a greyed-out affordance they can reason about.

## Tests written

None. `docs/agents/testing.md`: model/stateful-flow tests only by
default, hand-written tests only when explicitly instructed. This is a
static disabled-prop + label change with no new state machine or flow
branch — `cats.length === 0` is already the store's own source of truth,
nothing new to model.

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests), `tsc
--noEmit`, `expo lint` (0 errors, pre-existing require()-in-tests
warnings only), `scripts/format-changed.mjs --check` (no warnings on any
file touched by this issue).

**Not run on-device.**
