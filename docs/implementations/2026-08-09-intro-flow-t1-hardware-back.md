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

## 2026-11-02 — fix

**Purpose:** Back on T2–T4 returned `false`, and the slides are local state on the only stack entry, so the app exited with no confirm.
**Change:** Back steps back a slide on T2–T4 and still confirms on T1. Annotate's empty state handles Back like its "Go back" button and reads width per render. Test: `IntroFlowScreen.test.tsx` "steps back one slide on hardware back past T1". See also [email opt-in note](2026-10-24-feat-email-opt-in.md).

## 2026-11-08 — fix

**Purpose:** Correct onboarding's unsupported timing/downstream-use claims and incorrect setup order (#381, #208).
**Change:** Describe actual photo/location/cat recording, background uploads, separate optional choices, permissions before sign-in, Google/email availability, and gated Apple/Facebook methods. Remove the one-minute estimate, rescue/TNR/prediction promises, and unverified non-commercial assurances. Layout/first-run comprehension remain device-verification work under #381. See the [consent note](2026-08-09-consent-66-location-permission-gate.md) and [backlog audit](../planning/2026-11-08-backlog-2026-11-07.md).

## 2026-11-11 — fix

**Purpose:** Make all Onboarding paragraphs reachable on short screens at enlarged
text, as requested by review finding F3.
**Change:** Slide content scrolls separately above the pinned Previous/Next group;
its minimum content height preserves centered placement when content fits.
Slide order, Back policy and Consent navigation are unchanged. Shared Text
provides the central scaling ceiling. See [shared layout changes](2026-10-28-ui-component-spacing-alignment.md)
for automated coverage and native validation limits.
