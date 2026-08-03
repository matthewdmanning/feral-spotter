# Sprint:cats — #153 relocate "Reset" from Edit Cat to Submission Details (2026-08-03)

Implements #153, part of #148 (Cat Observations sprint), per grilled
decisions in `docs/sprint_planning/2026-08-03-sprint-cat-observations-149-153-grill-decisions.md`.
Branch `issue-144-camera`. Code complete.

## What shipped

**Moved, not rewritten.** `handleReset`'s body (confirm `Alert`,
`deleteSubmissionCache`, `clearDraft()`, `clearPhotos()`,
`stopLocationCapture()`, `router.replace('/')`) is unchanged — verified
before moving it that it had zero per-cat dependencies (`form`,
`existingCat`, `annotationEnabled` never appear in it) despite living
inside the per-cat-scoped `useCatSubmit` hook, which is exactly why the
move was safe as a pure relocation.

- `useCatSubmit.ts`: removed `handleReset` and the `clearDraft`,
  `clearPhotos`, `getCurrentCacheId`, `deleteSubmissionCache`,
  `stopLocationCapture` wiring it needed. `CatSubmitResult` no longer
  exposes `handleReset`.
- `useSubmissionSubmit.ts`: added `handleReset`, identical body, next to
  `handleDone` — same hook `create/index.tsx` already calls, same
  whole-submission scope. Added `deleteSubmissionCache` to the existing
  `submissionCache` import; `getCurrentCacheId`, `clearDraft`,
  `clearPhotos`, `stopLocationCapture` were already in scope there.
  `SubmissionSubmitResult` now returns `{ handleDone, handleReset,
  isSubmitting }`.
- `cats/index.tsx`: removed the `Reset` `Pressable` and the `divider`
  between it and `Clear`. `Clear` (`form.handleClear`, per-cat form
  reset) stays — it was explicitly out of scope, it clears only the
  current cat's fields, not the whole submission.
- `cats/index.styles.ts`: removed the now-dead `divider` rule (grep
  confirmed no other usage).
- `create/index.tsx` (Submission Details): added a `Reset` button below
  the `Finished!` button, wired to the relocated `handleReset`.
- `create/index.styles.ts`: added `resetBtn`/`resetBtnText` (outlined,
  `theme.colors.danger` border/text — same danger-color convention the
  old header buttons used, but as a full-width bottom button matching
  `doneBtn`'s shape rather than a small header link, since it now lives
  among the screen's primary actions).

## Reasoning

Grilled rationale, directly from the user: "Reset" wipes the whole
submission, so it belongs on the whole-submission screen (Submission
Details), not a single cat's form (Edit Cat). The user also pushed back
twice on granular hook-placement questions during the grill session,
asking "what does handleReset do?" before answering — once that was
explained in plain language, the answer ("there's already a button for
that on that screen... Reset should wipe every cat but live in the
screen that lists all cat entries") mapped directly onto merging the
logic into `useSubmissionSubmit.ts`, which was made as a judgment call
since a follow-up on the exact target hook went unanswered a second
time, and flagged to the user rather than silently decided.

## Tests written

Moved (not duplicated) the existing `handleReset` hook test:
`__tests__/hooks/useCatSubmit.reset.test.ts` →
`__tests__/hooks/useSubmissionSubmit.reset.test.ts`, retargeted at
`useSubmissionSubmit()` instead of `useCatSubmit(...)`, mock set aligned
with the sibling `useSubmissionSubmit.submitFlow.test.ts` (same hook,
same module-level `submitObservation`/consent/secure-store/posthog
imports need mocking now that the assertion runs through
`useSubmissionSubmit` instead of `useCatSubmit`). Assertion unchanged:
`handleReset()` still tears down the background Live-fix reacquire
(`stopLocationCapture`).

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests — the
renamed reset test included), `tsc --noEmit`, `expo lint` (0 errors,
pre-existing require()-in-tests warnings only),
`scripts/format-changed.mjs --check` (no warnings on any file touched by
this issue).

**Not run on-device.**
