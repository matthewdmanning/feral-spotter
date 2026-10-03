---
title: Remove this Cat
aliases:
  - Feature implementation note
tags:
  - implementation
---

# Remove a saved cat, from the Cat List or the Cat Form

**Scope:** feature
**Issues/spec:** #299 (closes)
**Date:** 2026-08-25
**Branch/PR:** issue-299-remove-this-cat

## Problem

Removing a cat meant Reset — throwing away the whole submission for a routine
correction. A user who boxed the wrong animal, double-counted one cat across
two passes, or simply changed their mind had no smaller recourse.

## What shipped

Two affordances, one owner (`src/hooks/useRemoveCat.ts`): a trash control on
each Cat List row, and **Remove this Cat** on the Cat Form while editing an
already-saved cat. Both confirm first. The hook clears the cat's boxes, drops
the `ObservedCat` row, and clears `activeCatId` if it happened to name the
removed cat.

Removing the *last* cat no longer leaves a blank screen. The Cat List's
zero-cats state now offers annotate-or-describe rather than forcing either —
see [[2026-08-06-cats-173-cat-list-auto-skip]] for how that interacts with the
first-pass auto-skip, and `docs/design-decisions/cat-list-empty-state.md` for
the decision itself.

`useRemoveCat` is the intended consumer of `useBoundingBoxStore.clearForCat`,
which had zero callers since it was written.

## Load-bearing landmines

- **Photos are never removed.** The photo pool is submission-scoped, not
  cat-scoped (ADR-0004), and one photo can show several cats. Removing a cat
  must not remove images another cat is boxed on.
- **This does not sit behind `lib/submission/draft.ts`.** That seam owns
  *whole-draft* teardown (ADR-0006, #292). Here the draft survives and one cat
  does not. Routing this through it would make "clear the draft" and "remove a
  cat" the same operation.
- **An unsaved cat has no Remove.** Backing out of one is
  `useAbandonCatGuard`'s job (#304) — a different action with different copy.
  The Cat Form's `onRemove` prop is optional for exactly this reason; passing
  it unconditionally would offer Remove on a cat that was never saved.
- **The Cat Form's remove navigates explicitly, never `router.back()`.** For
  the first cat of a submission, Cat Form is reached through a chain of
  `replace`s that strips Cat List off the stack (the #203 trap). It routes to
  `/submission/create` with `removed: '1'`.
- **That `removed` param is load-bearing**, not decoration. It is the only
  thing distinguishing "emptied by removing the last cat" from "arrived with
  nothing recorded" — the auto-skip treats those oppositely.
- **The row's trash is a nested `Pressable`.** Tapping it must remove, not open
  the cat for edit. Verified on device; easy to break by restructuring the row.

## Tests

- `src/hooks/__tests__/useRemoveCat.test.ts` — teardown ownership: boxes
  cleared, cat dropped, `activeCatId` cleared only when it matches, photos
  untouched, other cats unaffected.
- `src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx`
  — the zero-cats state: renders the choice rather than a blank screen when the
  last row is trashed in place, does not redirect, and routes each choice to its
  own destination. Also covers that arriving with nothing recorded *still*
  auto-skips.

## Verification status

`tsc --noEmit` (both tsconfigs), full `jest` (54 suites / 248 tests), `expo
lint` (0 errors), `format-changed.mjs --check` — all pass.

**Device-verified on a Pixel 7.** Both call sites, the confirm dialog, the
nested-Pressable behaviour, the empty state after in-place removal, and both of
its routes. Photos survived the removal (`1 / 2` still present on re-entering
annotate).

**Not exercised:** removal with two or more cats present — every device removal
ran against a single cat, so "your other cats are not affected" is covered by
unit tests only. Submit end-to-end was never pressed, so no upload happened.

## Follow-ups and known limitations

- The buttons added here are hand-rolled next to the `AppButton` atom that
  already covers them. Tracked as #315, deliberately deferred: adopting the
  atom changes button metrics app-wide.
