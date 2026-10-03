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
  _deleted_ photo specifically, keeping a "revert to" box for a photo
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
- same cat's _other_ photo untouched (suffix match, not prefix).

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

## 2026-08-07 — fix (#187)

**Purpose:** the on-device pass that finally exercised `annotate`
(`emulator/run-notes/2026-08-06-cats-sprint-annotate-drive.md`) couldn't
reach the remove-photo trigger at all — five tap/long-press attempts at
its reported bounds all failed, one opened the Android notification
shade instead of hitting the app. That meant the cleanup logic shipped
by this note had never actually been exercised for real, only unit-
tested. Root cause: `annotate` is a `fullScreenModal` with
`headerShown: false`, edge-to-edge, and `index.styles.ts`'s `topBar` had
no top safe-area inset — the OS status-bar strip sat directly over
`topRow`'s content, including the remove-photo button, intercepting
touches before they reached the app.

**Change:** `index.styles.ts`'s `topBar` gains `paddingTop: rt.insets.top + 10`
(this repo's existing `StyleSheet.create((theme, rt) => ...)` / `rt.insets`
pattern, matching `PhotoPreviewModal.styles.ts` rather than introducing a
`useSafeAreaInsets` hook). Also added the missing
`accessibilityLabel="Remove photo"` on the same `Pressable`
(`index.tsx:101-109`) — a separate a11y gap found in the same spot, fixed
in the same pass rather than as its own ticket.

No change to `useAnnotatePass.ts` or `useBoundingBoxStore.ts` — the
sweep logic (`removeBoxesForPhoto`) was already correctly wired to
`handleLongPressRemove`'s `doRemove()`; this was purely a touch-target
reachability bug, not a logic bug.

**Verification status:** `tsc --noEmit`, `eslint`, full `jest` (29/29
suites) all pass — none of the sweep logic changed, so its existing unit
coverage stands unchanged. **Not yet re-verified live on-device** — the
actual point of this fix (confirming the button is now tappable and the
sweep fires for real) requires the emulator pass this note's prior entry
never got; blocked this session on host battery mid-boot, tracked as the
remaining open item on #187.
