# Sprint:cats — #173 Cat List zero-friction on-ramp (2026-08-06)

Implements #173, blocked by #170 (annotate-first cat discovery, merged to
`sprint/cat-annotate-flow`). Branch `issue-173-cat-list-auto-skip`, forked
from `sprint/cat-annotate-flow`. Code complete.

## What shipped

`src/screens/submission/create/index.tsx` (`CreateSubmissionScreen`, the
Cat List screen):

- New `useEffect` that calls `router.replace('/submission/annotate')`
  whenever `cats.length === 0`. `replace`, not `push`, so annotate's
  hardware back (`clearActiveCat` in `useBackHandler`) pops past Cat List
  entirely instead of landing back on it and re-triggering the redirect.
- New early `return null` immediately before the JSX return, once
  `cats.length === 0` — nothing renders for the one frame before the
  redirect effect fires. Placed after every hook in the component (all
  hooks still run unconditionally every render) to satisfy the Rules of
  Hooks; an earlier draft placed the early return before the
  location-commit effect and the `useCallback`s, caught and fixed before
  running tests.

No other files changed — `handleAddCat` (routes to `/submission/annotate`
on "Add a Cat") and `handleDone`/`handleReset` were already correct for
this flow and needed no changes.

## Tests written

New `src/screens/submission/create/__tests__/CreateScreen.autoSkipGate.model.test.tsx`,
following `HomeScreen.photoSourceGate.model.test.tsx`'s pattern (render
the real screen, mock its store/router deps, gate on a small `xstate`
machine rather than driving the persisted `useSubmissionStore` live —
same react-test-renderer + AsyncStorage-rehydration crash this repo's
other screen tests route around).

- Two-state machine (`emptyList` / `hasCats`, `CAT_ADDED` transition).
- `emptyList`: asserts `router.replace` was called with
  `/submission/annotate` and that "Cats Recorded" never rendered.
- `hasCats`: asserts "Cats Recorded" renders and `router.replace` was
  called exactly once — a regression guard against a double-redirect,
  not just "some redirect happened."
- No `CAT_REMOVED` event/state: `cats` only ever grows via `addCat`, and
  the only whole-draft clear (`handleReset`) calls `router.replace('/')`
  before Cat List could re-render with an empty list — confirmed via grep
  (no `removeCat`/`deleteCat` in `useSubmissionStore.ts`) and by reading
  `useSubmissionSubmit.ts`. An earlier draft included this journey as a
  fictional user path; removed before finalizing since there's no real
  way to reach it.

## Verification status

Gates run and passing: full `jest` suite (26 suites / 98 tests, up from
25/96 baseline), `tsc --noEmit` (0 errors), `eslint` on both changed
files (0 errors — 1 pre-existing `require()`-in-mock warning, same
pattern already in `CreateScreen.locationCommit.test.tsx`), `prettier
--check` clean.

**Not run on-device.** No emulator pass this session covered the Cat
List auto-skip specifically.

## Not yet done

PR not created this session — see next commit for branch/PR details.

## 2026-08-07 — fix (#189)

**Purpose:** the "no real way to reach [`cats` dropping back to 0 while
mounted]" reasoning above (both the removed test journey and
`useSubmissionSubmit.ts`'s own comment: "handleReset navigates straight
to `/` before Cat List could re-render with an empty list") turned out
to be wrong. Live-reproduced on-device (`Reset` → confirm on Submission
Details): the underlying stores (`cats`, `photos`) correctly cleared —
confirmed by pulling and inspecting the app's `RKStorage` AsyncStorage
DB directly before/after — but the screen landed on `annotate`'s empty
state instead of Home. Root cause: this effect's own
`router.replace('/submission/annotate')` (fired by `cats.length`
dropping to 0) raced `handleReset`'s `router.replace('/')` and won.
Reordering `handleReset`'s statements was tried first and **did not
fix it** — confirmed live, twice, with a forced reload each time to
rule out stale bundles — because `useEffect` always runs after the
triggering synchronous callback finishes regardless of statement order
within it; the race isn't call-order-determined.

**Change:** `create/index.tsx`'s auto-skip effect now gates on a
mount-time snapshot (`useRef(cats.length === 0)`, checked inside a
`useEffect(() => {...}, [])`) instead of reactively watching
`cats.length`. This matches #173's actual intent — a landing-time check
("I arrived here with nothing recorded"), not a standing invariant —
and structurally can't re-fire later in the same mount for any reason,
Reset included. The early `return null` render guard (`cats.length ===
0`) is unchanged; only the effect's trigger changed.

Added the `CAT_REMOVED` journey the original test explicitly declined
to write, now that it's a real, reproduced path: `hasCats` →
`emptiedAfterHavingCats` (a distinct state from `emptyList`, not a
return to it — same `cats.length === 0` app state, different expected
behavior by history) asserts `router.replace` stays at its
already-fired count, not a second call.

**Verification status:** `tsc --noEmit`, `eslint`, full `jest` (30/30
suites) all pass. **Live-verified on-device** (not just unit tests) —
reproduced the bug pre-fix (landed on annotate's empty state after
Reset), then reproduced the fix post-fix (lands on Home, `RKStorage`
dump confirms `cats:[]`/`photos:[]`) via a forced Metro reload between
each attempt.

## 2026-08-25 — extension

**Purpose:** #299 made zero-cats a state a user can deliberately reach, which
the mount-time auto-skip gate treated identically to arriving with nothing
recorded.

**Change:** the gate is now
`useState(() => cats.length === 0 && removed !== '1')`, and the render's
early return is `cats.length === 0 && autoSkipPending`. Removing the last cat
renders the annotate-or-describe empty state instead of redirecting. Details in
[[2026-08-25-issue-299-remove-a-saved-cat]].

**Load-bearing landmines:**

- **Both halves of the render guard are needed.** `autoSkipPending` is frozen at
  mount, so `if (autoSkipPending) return null` alone would blank the screen
  forever if the user returns with cats added while it stays mounted.
- **Lazy `useState`, not `useRef`.** The render reads it to choose between
  "redirect in flight" and "empty state," and reading a ref during render is a
  React Compiler violation. The mount-time snapshot semantics are unchanged —
  #189's reason for not watching `cats.length` live still holds.
- **First-pass auto-skip is unchanged and must stay that way.** Arriving with
  nothing recorded still replaces into annotate; only the removal path opts out.
