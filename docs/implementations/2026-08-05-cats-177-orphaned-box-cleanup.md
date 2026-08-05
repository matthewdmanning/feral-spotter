# Sprint:cats — #177 orphaned box cleanup on photo removal (2026-08-05)

Implements #177, filed during #172's review as a pre-existing gap
promoted to source-of-truth relevance. Branch
`issue-177-orphaned-box-cleanup-on-photo-removal`, forked from
`origin/sprint/cat-annotate-flow` (pre-#172 — #172 is still an open PR,
#176, not yet merged). Code complete.

## What shipped

`useBoundingBoxStore.ts`:

- New `removeBoxesForPhoto(photoId): void` — sweeps `boxes`, `absences`,
  and `lastBoxes` for every key ending `:${photoId}`, across all cats
  (a photo can carry boxes for more than one cat, per spec story 4).
  Mirrors `getBoxesForPhoto`'s existing suffix-match pattern.

`useAnnotatePass.ts`: `handleLongPressRemove`'s `doRemove()` now also
calls `removeBoxesForPhoto(photo.local_id)`, alongside the existing
`removePhoto`/`removeAnnotationSet`.

## Scope check before writing code

Grepped `removePhoto(` and `clearPhotos(` call sites before assuming a
single-call-site fix was sufficient (advisor review flagged this as the
thing to verify, not assume):

- `removePhoto` has two callers: `useAnnotatePass.handleLongPressRemove`
  (mid-pass, boxes can exist — fixed here) and
  `useCameraCapture.handleDiscardPhoto` (pre-annotate camera review,
  boxes cannot exist yet since the photo hasn't reached the pool the
  annotate screen operates on — not affected).
- `clearPhotos`/`clearDraft` (submit-success and reset paths, in
  `useSubmissionSubmit.ts`) not sweeping the box store is the ADR 0004
  Consequences section's already-accepted "orphaned box data can
  accumulate, cleanup deferred" case — a different, already-decided
  question. Left untouched.

## Deliberate inclusions/exclusions

- `lastBoxes` is swept alongside `boxes`/`absences`, even though
  `clearForCat` doesn't sweep it (precedent for leaving it). For a
  *deleted* photo specifically, keeping a "revert to" box for a photo
  that no longer exists would recreate the exact class of staleness this
  ticket fixes — included deliberately, not by default.
- This branch is based on `sprint/cat-annotate-flow` before #172 merged,
  so `getBoxedPhotoIds`/`getFirstBox` (added in #172) don't exist here.
  The originating issue's test-scope line ("back-fill coverage for
  `getBoxedPhotoIds`/`getFirstBox`") could not be done from this branch
  — deferred to a follow-up once #172 merges, not silently dropped.

## Tests

New `src/hooks/__tests__/useBoundingBoxStore.test.ts`, pure reducer test
(no rendering) matching `usePhotoStore.source.test.ts`'s precedent — the
spec's testing decisions explicitly carve this out for pure derivation
functions:

- multi-cat sweep: two cats with boxes on the same photo, both cleared.
- absences swept across cats the same way.
- `lastBoxes` cleared.
- same cat's *other* photo untouched (suffix match, not prefix).

## Explicitly not addressed (flagged in the issue, not this PR's job)

If the removed photo held the active cat's only box, cleanup leaves
`activeCatId` set with no boxes and no crop — "Boxing Complete" still
routes to Cat Form and would save a cat with an empty photo list.
Whether removing the last box should also clear the active cat is a
product call, not made here.

## Verification status

Gates run and passing: full `jest` suite (25 suites / 96 tests, up from
24/92 baseline), `tsc --noEmit` (0 errors), `eslint` on all
touched/created files (0 errors — 1 pre-existing `require()`-in-mock
warning, same pattern as `usePhotoStore.source.test.ts`), `prettier
--write` run on all touched/created files.

**Not run on-device** — same gap noted in #171/#172's notes for this
sprint; no automated UI coverage of the annotate screen exists.

## Not yet done

Commit and PR not created this session. PR should target
`sprint/cat-annotate-flow` (not `main`), same as #170/#171/#172.
