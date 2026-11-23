# Navigation stack fixes from a hooks and wiring review

**Scope:** fix
**Issues/spec:** review of hooks, wiring and navigation; no issue
**Date:** 2026-11-23
**Branch/PR:** `fix/hooks-navigation-logic-review`

## Intent

**Purpose:** Three flows grew or kept stale screens on the stack. Duplicate
Submission Details each ran `useDraftSync`; a leftover Sign-in reopened for a
signed-in user on Back from Home.

## What shipped

| Flow                                              | Was                                                                          | Now                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Cat pass back to Cat List (`catPass`)             | `router.replace` → `[create, create]` per saved, abandoned or removed cat    | `router.dismissTo`: pops to the existing Cat List; adds one only when none is beneath |
| Camera Done (`useCapturedPhotoWorkflow`)          | `router.navigate` pushed a new Submission above Camera each Take More Photos | `router.dismissTo`: returns to the open Submission, or replaces Camera                |
| Sign-in / Registration success (`useAuthAttempt`) | `router.replace` swapped Registration only; Sign-in stayed under Home        | `startOver()` (`shared/lib/navigation.ts`): dismiss all, then replace                 |

Consequence: Camera no longer sits beneath Submission Details. Back from the
first cat's Cat Form header (guarded by `useAbandonCatGuard`) now reaches
Home, not Camera.

## Tests

| Test file                                                              | What it verifies                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/features/draft-submission/hooks/__tests__/flow.catPass.test.tsx`  | Real router: save, abandon and remove each end on one Cat List; replace-chain still lands |
| `src/features/camera-control/hooks/__tests__/flow.cameraDone.test.tsx` | Real router: Done from Home and after Take More Photos leaves `[index, submission]`       |
| `src/features/auth/hooks/__tests__/flow.authAttempt.test.tsx`          | Real router: Registration from Sign-in leaves nothing to go back to                       |

Each failed before its fix. Mocked-router expectations moved from `replace` /
`navigate` to `dismissTo`; the subsumed `useCameraCapture` handleDone case was
deleted.

## Verification

Ran: `npx jest` (142 suites, 666 tests pass), `tsc` (app and test configs),
ESLint and Prettier on changed files. Not run: device or emulator drive.
Needs test drive: native-stack transitions for `dismissTo` from the
fullScreenModal Camera and Annotate.
