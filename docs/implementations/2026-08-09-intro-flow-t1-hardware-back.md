# 2026-08-09 — Intro-flow T1 hardware back

Closes #98.

## What shipped

- `IntroFlowScreen` (`src/screens/intro-flow/index.tsx`) now intercepts
  Android hardware back via `useBackHandler`, matching `consent`'s existing
  Decline→Exit pattern (`docs/planning/2026-07-27-onboarding-registration-consent-fsm.md`).
- Only intercepted on T1 (`step === 0`, no route to pop to): shows a
  confirm-exit `Alert` (Back / Exit), Exit calls `BackHandler.exitApp()` on
  Android. T2–T4 return `false` from the handler, falling through to the
  existing default native pop (unchanged).
- New copy: `EXIT_WARNING_TITLE` / `EXIT_WARNING_BODY` in
  `src/config/introFlowCopy.ts`.

## Tests

`src/screens/intro-flow/__tests__/IntroFlowScreen.test.tsx` (extended,
mocks `useBackHandler` to capture the registered handler, same pattern as
`ConsentScreen.test.tsx`):

- warns before exiting on hardware back at T1
- exits the app on Android when Exit is confirmed at T1
- does not intercept hardware back past T1 (handler returns `false`)

## Verification

- `npx jest src/screens/intro-flow` — pass (5/5).
- `npx tsc --noEmit` — clean.
- `npx eslint` on touched files — clean (one pre-existing, unrelated
  `no-require-imports` warning in the test file's `AppButton` mock).
- Not device-tested this session (no physical device in this environment).
