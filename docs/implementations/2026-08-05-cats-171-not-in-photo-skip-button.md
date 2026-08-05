# Sprint:cats — #171 "Not in this photo" explicit skip button (2026-08-05)

Implements #171, blocked by / built on #170 (annotate discovers cats via
first box, commit `7dd3849`, not yet merged to `main`). Branch
`issue-171-not-in-photo-skip-button`, forked from `sprint/cat-annotate-flow`
(not `main`) since #170's commit lives only there. Code complete.

## What shipped

`useBoundingBoxStore.ts`:

- New `absences: Record<string, true>` state, same `${cat_id}:${photo_local_id}`
  keying as `boxes`.
- New `markAbsent(catId, photoId)` action — writes the absence key and
  deletes any box at the same key.
- `addBox` now also deletes any absence entry at the same key.
- Box and absence are mutually exclusive for a given cat+photo slot:
  whichever of `addBox`/`markAbsent` ran last wins, in one atomic `set()`.
- `clearForCat` now sweeps `absences` alongside `boxes`.
- `migrate()` (v1→v2) return updated to include `absences: {}` explicitly.

`useActiveCatFlow.ts`:

- `PhotoPassStatus` extended: `'pending' | 'located' | 'not-in-photo'`.
- `getPhotoStatus` checks `boxes` first (`located`), then `absences`
  (`not-in-photo`), else `pending` — reads as exclusive because the store
  guarantees it's exclusive.
- New `handleNotInPhoto(photoId)`: no-ops if `activeCatId` is null (no cat
  declared yet, nothing to record against — real UI path can't reach this,
  see below); otherwise calls `markAbsent`.

`useAnnotatePass.ts`:

- New `handleNotInPhoto()` wrapper mirroring `handleConfirmBox`'s
  advance-to-next-photo logic exactly (same `carouselRef.scrollTo` /
  `setCurrentIndex` guard on `currentIndex < photos.length - 1`).

`annotate/index.tsx` + `index.styles.ts`:

- New pill button in the bottom bar, between Back and Boxing Complete —
  `theme.radius.full`, local `pillBtn`/`pillBtnText` styles (this screen
  already uses ad-hoc local button styles, not the `AppButton` atom, so
  matched that existing convention rather than introducing a new one).
- Disabled (`navBtnDisabled`, reused) when `!activeCatId` — no cat exists
  yet, so there's nothing to mark absent against. This makes the button's
  enabled state an honest signal instead of a silent no-op tap.
- Dots strip: added a third color branch, `theme.colors.warning`, for
  `not-in-photo` (previously a two-way `located`/else ternary).

## Design decision from advisor review

Initial draft treated `boxes` and a separate absence store as independent
—found via advisor review before writing code that this was a real bug:
box photo → advance → back up → tap "Not in Photo" would record absence
while the box (and its `located` status) silently survived, since
precedence just checked boxes first. Fixed by making the two mutually
exclusive at the single store, one `set()` per write, rather than two
stores with a cross-store invariant to maintain by hand.

Also on advisor's input: the null-`activeCatId` case is handled as an
honest disabled state in the UI (`disabled={!activeCatId}`), not a
silent no-op — the tap either does something visible or the button isn't
tappable, never both-in-different-circumstances.

## Tests written

Extended `useActiveCatFlow.model.test.ts` (the "ticket-1 model test" the
issue's acceptance criteria names):

- `NOT_IN_PHOTO` added to the machine as a self-loop on `annotating` only
  — not on `idle`, since the UI disables the pill before any cat exists,
  so a real user journey never fires it from `idle`. Comment updated to
  explain (previous comment said `NOT_IN_PHOTO` was deliberately absent,
  pointing at this ticket).
- `testParams.events.NOT_IN_PHOTO` targets `photo-3` (distinct from
  `photo-1`/`photo-2`, which the existing `annotating` state assertion
  already checks at every visit) and asserts `not-in-photo` unconditionally
  — no conditional branch in the assertion, since the event is now only
  reachable from a state where a cat already exists.
- New journey: `BOX_CONFIRMED -> NOT_IN_PHOTO -> BOXING_COMPLETE`, proving
  the absence marker doesn't disrupt the existing boxing-complete
  transition.
- Two new standalone `it()`s (matching this file's existing pattern for
  invariants that don't fit the shared per-state assertions):
  mutual-exclusivity round trip (box → absence → box on the same
  photo, asserting the status flips both ways) and the
  no-active-cat-no-op guard.
- Mock `useBoundingBoxStore` factory extended to mirror the real store's
  `absences` state and mutual-exclusion behavior in both `addBox` and the
  new `markAbsent`.

**Not tested**: the "advances to next photo" half of the acceptance
criteria lives in `useAnnotatePass` (carousel ref, `usePhotoStore`), one
hook above where the model test renders. This seam has no test coverage
at all currently — not even for the existing `handleConfirmBox` advance
behavior — so no new test infrastructure was added for it, consistent
with matching existing coverage rather than expanding scope. Flagged by
the Explore investigation before implementation; confirmed by grep
(no `useAnnotatePass.test.*` or `annotate/**/*.test.*` files exist).

## Verification status

Gates run and passing: full `jest` suite (24 suites / 92 tests, up from
23/84 baseline), `tsc --noEmit -p .` (0 errors), `eslint` on all six
changed files (0 errors — 4 pre-existing `require()`-in-mock warnings,
same pattern already in the file before this change), `prettier --check`
on all six changed files (clean after one `--write` pass on
`useBoundingBoxStore.ts` and `index.styles.ts`).

**Not run on-device.** No automated coverage of this screen's UI exists
(same gap noted in #151's implementation notes) — worth an on-device pass
before merge given this changes bottom-bar layout and dot-strip color
logic on a real annotate screen.

## Not yet done

Commit and PR not created this session — working tree is clean-plus-six-
modified, uncommitted. PR should target `sprint/cat-annotate-flow`
(not `main`) per the branch-off reasoning above, so `gh pr create`'s
default base needs to be overridden explicitly with `--base
sprint/cat-annotate-flow`.
