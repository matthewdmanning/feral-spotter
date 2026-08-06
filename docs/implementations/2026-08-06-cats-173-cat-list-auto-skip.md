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
