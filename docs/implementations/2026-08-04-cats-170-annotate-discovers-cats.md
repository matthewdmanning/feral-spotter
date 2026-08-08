# Sprint:cats — #170 Annotate discovers cats via first box, core mechanic (2026-08-04)

Implements #170, blocked by nothing (first ticket in the sprint). Commit
`7dd3849`, authored 2026-08-04, committed directly to
`sprint/cat-annotate-flow` — **no branch/PR was opened for this one**,
unlike every other ticket in this sprint. This note is written
retroactively on 2026-08-06 to close the documentation gap; verification
details below are reconstructed from the commit diff, not re-run.

Flips the flow per ADR 0004 (`docs/adr/0004-cats-annotate-flow.md`,
written in this same commit): annotate first, describe second. No more
upfront cat-count step or `cat_id` route param — a cat is discovered by
drawing its first box.

## What shipped

`useActiveCatFlowStore.ts` (new): persisted zustand store holding just
`activeCatId: string | null` across the `annotate` → Cat Form
navigation, separate from `useActiveCatFlow` so it can be mocked
independently in tests (matching `useBoundingBoxStore` /
`useSubmissionStore` / `usePhotoStore`'s pattern).

`useActiveCatFlow.ts` (new, 87 lines): owns the active cat id, per-photo
pass status (`getPhotoStatus`), and the pass-driving handlers
(`handleBoxConfirmed`, `handleNotInPhoto`, `handleBoxingComplete`,
`clearActiveCat`). The first confirmed box with no active cat mints a
new local cat id via `randomUUID()` and starts tracking it.

`useAnnotatePass.ts` (new, replaces the old per-cat-subset logic):
screen-local carousel state (current photo index, ref) layered on top of
`useActiveCatFlow`. `annotate` now operates on the full photo pool
(`usePhotoStore`) instead of a fixed per-cat subset — there's no cat to
scope by until one exists.

`useAnnotateStateMachine.ts` deleted (171 lines) — replaced by the
`useActiveCatFlow`/`useAnnotatePass` split above.

`AnnotateCarouselItem.tsx`: reworked (99 insertions / 39 deletions) to
draw/confirm a box against the active-cat-flow seam instead of a route
param.

`useCatSubmit.ts`: `handleSave`'s `localId` now falls back to
`activeCatId` before minting a fresh `randomUUID()` — the cat's id was
already minted in `annotate` on its first box, so Cat Form reuses it
rather than creating a second, orphaned id. `clearActiveCat()` called on
save since the cat is no longer "in-progress."

`screens/submission/annotate/index.tsx`: reads `activeCatId` from the
new hook instead of a route param; "Boxing Complete" decoupled from
per-photo box confirmation so it's callable at any point in the pass
(previously required a box on the current photo).

`screens/submission/create/index.tsx`: minor wiring change (5 lines) —
not `#173`'s auto-skip, which didn't exist yet at this point in the
sprint.

Also in this commit: `docs/adr/0004-cats-annotate-flow.md` (new ADR),
`docs/planning/grilling/2026-08-04-cats-annotate-flow-spec.md` and
`docs/sprint_planning/2026-08-04-cats-annotate-flow-tickets.md` (sprint
planning docs that seeded #169's ticket breakdown).

## Tests written

`src/hooks/__tests__/useActiveCatFlow.model.test.ts` (new, 183 lines) —
xstate model test at this seam using `getPathsFromEvents`, per the
acceptance criteria's explicit ask and `HomeScreen.gate.model.test.tsx`
precedent. Covers the happy path, "Boxing Complete" at arbitrary points
in a pass, and mid-pass abandonment. This file was later extended by
#171 (`NOT_IN_PHOTO`) rather than duplicated.

## Verification status

**Reconstructed, not re-run.** The original session's `tsc`/`jest`/
`eslint`/`prettier` output wasn't captured in any implementation note at
the time (this is the gap this note fixes). Diff shape and the presence
of a passing model test file are consistent with the same gate discipline
applied to every other ticket in this sprint, but that's an inference
from the diff, not a rerun result. If this needs re-verifying, run the
full gate set against `7dd3849` directly rather than trusting this note's
"reconstructed" label as equivalent to a real pass.

## Process note

No branch or PR exists for this ticket — the commit went straight to
`sprint/cat-annotate-flow`, breaking from the `issue-N-*` branch pattern
every other ticket in this sprint used (#171 → #175, #172 → #176, #173 →
#183, #177 → #178). The commit message says `Closes #170`, but since it
was never merged via a PR into the repository's default branch, GitHub
never auto-closed the issue — that's why #170 was still open as of
2026-08-06 despite being fully shipped. Closed manually; flagging the
missing-PR gap rather than fabricating one retroactively, since there's
no new code to merge — `7dd3849` is already on the target branch.
