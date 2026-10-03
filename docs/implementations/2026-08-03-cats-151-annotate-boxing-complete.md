# Sprint:cats — #151 Annotation Box: drop duplicate "Done", relabel to "Boxing Complete" (2026-08-03)

Implements #151, part of #148 (Cat Observations sprint), per grilled
decisions in `docs/sprint_planning/2026-08-03-sprint-cat-observations-149-153-grill-decisions.md`.
Branch `issue-144-camera`. Code complete.

## Correction found before implementing

The original ask ("remove Done and Cancel") didn't match current code.
Read `annotate/index.tsx` directly (twice, after the user disputed an
earlier Explore-agent summary) and confirmed: no "Cancel" button exists
anywhere on this screen, and "Done" appeared twice — a top-bar button
and a bottom-nav primary button — both calling the same `handleDone`
(`useAnnotateStateMachine.ts`). Nothing to remove for "Cancel"; the two
"Done"s were a plain duplicate, not two different actions.

## What shipped

`annotate/index.tsx`:

- Deleted the top-bar `Done` `Pressable` (was `topBtn`/`topBtnText`,
  calling `handleDone`). `topRow` now holds just the photo counter and
  the remove (trash) button.
- Bottom-nav primary button text is now the literal string
  `'Boxing Complete'` in every state — replaces the old
  `{isLast ? 'Finish' : 'Done →'}` conditional. `isLast` became unused
  after that and was deleted along with it.
- Removed the now-dead `topBtn`/`topBtnText` rules from
  `annotate/index.styles.ts` (grep confirmed no other usage).

## Reasoning

Grilled decision: keep the bottom-nav button as the sole exit, since the
header back arrow and swipe gesture are already disabled at the layout
level (`src/app/submission/_layout.tsx`: `headerShown: false`,
`gestureEnabled: false`) — the bottom button's logic doesn't change here,
only its label, so this is safe: it was already the only scripted way
off the screen.

"Boxing Complete" replacing both "Done →" and "Finish" was the last-photo
label decision, confirmed via `/mattpocock-skills:grill-with-docs`
continuation after an earlier tool-call interruption — same label
regardless of `isLast`, so the button reads consistently through the
whole carousel instead of changing wording right at the end.

## Tests written

None. No new state, no new branch — deleting a duplicate control and a
label swap. `useAnnotateStateMachine`'s `handleDone` transitions are
unchanged.

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests), `tsc
--noEmit`, `expo lint` (0 errors, pre-existing require()-in-tests
warnings only), `scripts/format-changed.mjs --check` (no warnings on any
file touched by this issue).

**Not run on-device.** No automated coverage of this screen exists
(`glob` for annotate tests came back empty before and after this
change) — worth flagging if #144's on-device pass gets scheduled, since
this is a navigation-affecting screen change.

## 2026-08-25 — fix

**Purpose:** On a one-photo submission, confirming the only box landed the user
on Home instead of the Cat Form, and left the draft behind with no sign the
pass had failed (#316).

**Change:** `handleBoxingComplete` in `src/hooks/useActiveCatFlow.ts` reads
`activeCatId` fresh via `useActiveCatFlowStore.getState()` instead of the
subscribed value.

**Load-bearing landmines:**

- **The mint and the completion happen in the same tick.**
  `useAnnotatePass.handleConfirmBox` calls `handleBoxConfirmed` (which mints the
  cat via `setActiveCatId`) and then, on the last photo, `handleBoxingComplete`
  — with no render in between. The subscribed `activeCatId` is still the
  pre-mint `null`, so the guard took the no-active-cat branch and abandoned.
- **Two or more photos hide it.** `Confirm` on any non-last photo advances the
  carousel instead, letting state settle across a render. Only a pass whose
  *first* evidence lands on the *last* photo is affected — in practice, a
  one-photo submission. Any test or drive using multiple photos will pass
  against the broken code.
- **`getBoxedPhotoIds` was never implicated.** It reads through `get().boxes`
  and already saw the box just added. Only the one subscribed value was stale.
- **`handleNotInPhoto` reaches this function the same way and is correct as-is.**
  A pass carrying only an absence mark has no boxes, so abandoning is the
  intended outcome there. Do not "fix" that path to match.
- This is the same stale-subscribed-value class that `clearActiveCatIfMatches`
  warns about one function above. Treat any value read inside a same-tick
  handler chain in this file as suspect.

**Tests:** new case in `src/hooks/__tests__/useActiveCatFlow.model.test.ts`
confirms a box and completes the pass inside a single `act()`. Verified to fail
against the previous implementation and pass against this one.

**Verification:** full gates pass (248 tests). Device-verified on a Pixel 7 —
the one-photo repro now routes `/submission/annotate` → `/submission/cats`.
Pre-existing on `main`; not introduced by #299 or #314.
