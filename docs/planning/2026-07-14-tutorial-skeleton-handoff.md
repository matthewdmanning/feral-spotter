# Session handoff — annotation tutorial skeleton (2026-07-14)

## What was built (first pass, per user's "bypass roadmap order" call)

Skeleton of the annotation tutorial (spec: `2026-07-14-annotation-tutorial-spec.md`, retargeted to Alpha but built early by explicit decision):

- `src/hooks/useTutorialStore.ts` — persisted status flag: `unseen | skipped | completed` (new store, exported from `src/hooks/index.ts` barrel)
- `src/components/organisms/TutorialOverlay.tsx` + `.styles.ts` — reusable step overlay (scrim, card, counter, Skip, primary button); steps passed as data
- `src/config/tutorial.ts` — 5 annotation tutorial steps (draft copy)
- `src/screens/submission/annotate/index.tsx` — overlay wired in: fires when status is `unseen`, skip/finish persist status, analytics on show/step/skip/complete
- `src/lib/analytics/analytics.ts` — added `tutorial_started/step_completed/skipped/completed` to EVENTS + `fireSimpleEvent()` (no submission-cache payload)

Dependency decisions (user-approved): no consent-screen gate, analytics events live now, funnel joins later.

## Verification status

- `tsc --noEmit`: PASS
- `eslint` on all changed files: PASS
- `jest`: **RAN BUT OUTPUT LOST to sandbox shutdown — rerun `npx jest` before committing**

## Second pass (not started)

- Gesture-validated step advancement (draw/adjust/label instead of Next buttons)
- Sandboxed sample photo session (bundled ear-tipped cat photo; must never touch submission store/GCS — spec P0)
- Settings "Replay tutorial" row (reset status to `unseen`)
- Unit tests: flag persistence, skip-at-each-step
- Pick sample photo (blocking open question in spec)

## Notes

- Assumption made: annotate screen is only reachable when `annotation_enabled` is true, so overlay gates on tutorial status only — verify.
- Sandbox mount had sync corruption this session; two files were repaired by writing identical content from the sandbox side. `git diff` should show only intended changes — review before commit.
- Camera screen ("may be bugged", MVP issue 6): code has all buttons wired; if they don't render it's a runtime/layout issue, not missing code. Needs device repro.
- Repo root has junk dir `C:UsersmattmAppDataLocalTemp` — delete before committing.
- Nothing was committed this session.
