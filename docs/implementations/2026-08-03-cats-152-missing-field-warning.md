# Sprint:cats — #152 non-blocking missing-field warning on save (2026-08-03)

Implements #152, part of #148 (Cat Observations sprint), per grilled
decisions in `docs/sprint_planning/2026-08-03-sprint-cat-observations-149-153-grill-decisions.md`.
Branch `issue-144-camera`. Code complete.

## Correction found before implementing

The issue's punchlist wording referenced #96's color-by-pattern
constraint as already in place. Reading `constants.ts` showed
`colorOptionsForPattern()` is still a pass-through that returns every
color regardless of pattern — #96 is closed but the constraint itself
was never implemented. Not a blocker for #152 (this issue only checks
whether fields are at their default, not what options a field offers),
flagged so it isn't mistaken for done elsewhere.

## What shipped

`useCatSubmit.ts` `handleSave`:

- Added `FIELD_LABELS`, a display-name map over all 8 `CAT_DEFAULTS`
  keys (age, earTipped, owned, pattern, hairLength, color, sex,
  healthLabel).
- Before committing, `handleSave` now diffs the current form values
  against `CAT_DEFAULTS` (plain `===` equality — no touched/dirty
  tracking) and collects the labels of any field still at its default.
- If any are unset, shows an `Alert` ("N fields not set — <list> — Save
  anyway?") with `Cancel` / `Save anyway`; `Save anyway` runs the same
  commit path (`addCat`/`updateCat` + navigate) that used to run
  unconditionally. If nothing is unset, it commits immediately — the
  warning never blocks, per the grilled decision.
- The store-mutation + navigate logic itself is unchanged; it just moved
  into a `commit` closure so both the direct and confirmed-via-Alert
  paths call the same code.

## Reasoning

**No touched/dirty tracking, by design.** The grill session initially
went to "true touched/dirty tracking" (a real state-shape change to
`useCatForm`), then reversed back to a plain value-equals-default check
on the next question — the user's own words: "no part item is selected,
user or loaded state doesn't matter." This also matches
`docs/agents/domain.md`'s Unknown/Unsure entry directly: _"there is no
separate 'left blank' versus 'confirmed unknown'; leaving an attribute
at its default and explicitly choosing Unknown/Unsure are the same
thing."_ Building touched-tracking would have fought the domain model,
not served it.

**Never a hard block.** Confirmed explicitly: "if any option is
selected, there is no warning. there is never a hard block." So this
is pure friction/awareness, not validation in the blocking sense —
consistent with `useSubmissionSubmit.ts`'s existing comment that "the
warning icon is informational, not a submit gate," applied here to
per-field state instead of location/time.

**Applies to both Observed Cat and Edit Cat.** The issue title says
"Edit Cat screen," but `handleSave` is the one save path shared by both
new-cat and edit-cat states of `cats/index.tsx` — there's no separate
hook instance to scope the check to just one. Defaults are equally
uninformative on a brand-new cat as on one being edited, so the check
was left unscoped rather than threading an `existingCat`-only branch
through `handleSave`. Flagging this as a judgment call since it wasn't
asked and answered explicitly in the grill session.

## Tests written

None. `docs/agents/testing.md` requires unit/integration tests only
when explicitly instructed, and load-bearing with a reasonable
probability of happening. The unset-field diff is a straightforward
array filter over a fixed key list with no branching state machine —
didn't rise to a case that needed a dedicated model versus the existing
`useCatSubmit`/`useSubmissionSubmit` test coverage pattern in this repo
(hand-written hook tests, not xstate models, for these two hooks).

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests), `tsc
--noEmit`, `expo lint` (0 errors, pre-existing require()-in-tests
warnings only), `scripts/format-changed.mjs --check` (no warnings on any
file touched by this issue).

**Not run on-device.**
