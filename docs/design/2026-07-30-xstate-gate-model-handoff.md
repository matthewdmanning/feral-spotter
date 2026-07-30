# XState gate-model: upgrade to UX-journey tests

Branch `issue-7-firebase-auth-migration`. Working file — do not commit.
Policy: `docs/agents/testing.md`.

## Objectives (done = all true)

- [ ] `gateMachine` has a `SIGN_OUT` event: `ready → unauthenticated`.
- [ ] Tests are driven by `getPathsFromEvents`; `getShortestPaths().forEach` block removed.
- [ ] Three journeys authored: happy path, returning-authenticated, sign-out round-trip.
- [ ] Each journey asserts the observed redirect at every step (`/intro-flow`, `/consent`, or home / no-redirect).
- [ ] `initializing` no-redirect-while-`!isReady` assertion retained (#93 guard).
- [ ] `HomeScreen.test.tsx` deleted.
- [ ] `npx jest HomeScreen.gate.model` passes; no scope beyond the gate.

## Task

Rewrite `src/screens/home/__tests__/HomeScreen.gate.model.test.tsx` to drive **UX journeys** via `getPathsFromEvents`, replacing the `getShortestPaths().forEach` block (coverage-only).

1. **Add event `SIGN_OUT`**: transition `ready → unauthenticated`; add `testParams.events.SIGN_OUT` = `setMocks(true, false, false); rerender`. A signed-in user signs out and must land on `/intro-flow`. This is the one missing user action.
2. **Author journeys** with `getPathsFromEvents`:
   - Happy path: `AUTH_READY_UNAUTHENTICATED → SIGN_IN → AGREE_CONSENT` (asserts `/intro-flow`, `/consent`, then home).
   - Returning: `AUTH_READY_WITH_CONSENT` → home directly.
   - Sign-out round-trip: `… → ready → SIGN_OUT` → `/intro-flow`.
3. Keep the `initializing` assertion (no redirect while `!isReady`) — it guards the #93 loop.

## Live gate (source of truth) — `src/screens/home/index.tsx:21-28`

- `!isReady` → no redirect
- `!isAuthenticated` → `/intro-flow`
- authenticated && `!hasAcceptedConsent()` → `/consent`
- else → home

Existing machine already mirrors this (states `initializing → unauthenticated | authenticatedNoConsent | ready`; events `AUTH_READY_*`, `SIGN_IN`, `AGREE_CONSENT`). Only `SIGN_OUT` is missing.

## Notes

- Scope = HomeScreen's app-gate redirect logic only. Do NOT expand to rendering intro-flow/sign-in/consent screens without asking.
- Also queued (classifier-blocked): `git rm src/screens/home/__tests__/HomeScreen.test.tsx` (4 hand cases, fully subsumed).
- Run: `npx jest HomeScreen.gate.model --verbose`
