/**
 * config/introFlowCopy.ts
 * Single source of truth for the first-run onboarding slides (route: intro-flow).
 * Spec: tutorial_copy.md (2026-07-13) — original filename; content is onboarding copy.
 * Rule: never "tracking" in reference to people — cats only.
 *
 * Permission priming lives in /consent (eager, on "I Agree") and the
 * contextual re-priming built for #41 (at point of use) — not here.
 */

export interface SlideCopy {
  header: string
  body: readonly string[]
  button: string
}

export const ONBOARDING_SLIDES: readonly SlideCopy[] = [
  {
    header: 'Every feral counts',
    body: [
      'See a feral cat? FeralSpotter lets you record a sighting with photos, a location, and the details you notice.',
    ],
    button: 'Next',
  },
  {
    header: 'Spot. Snap. Submit.',
    body: [
      'See a feral? Start a sighting. Take a photo or two, note what you can — ear tip, coat pattern, condition — then review and submit.',
      'Record what you know. You can leave details unknown when you are not sure.',
    ],
    button: 'Next',
  },
  {
    // T3 — informational only. Explicit acceptance happens on /consent,
    // not here (avoid double-gating the same disclosure).
    header: 'What you share',
    body: [
      'Photos you add can begin uploading while you work. Submitting sends the location and cat details with your sighting to the project’s cloud storage.',
      'The next screens explain data collection and permissions. Optional email updates and usage analytics have separate choices.',
    ],
    button: 'Next',
  },
  {
    header: 'Almost ready',
    body: [
      'First, review the data disclosure and set up permissions. Then sign in with Google or email, or create an account with email. Apple and Facebook sign-in are not available in this alpha.',
    ],
    button: 'Set up FeralSpotter',
  },
] as const

/** Index of the data-usage slide — its "Next" links out to the full agreement. */
export const AGREEMENT_SLIDE_INDEX = 2

export const DATA_AGREEMENT_LINK_LABEL = 'Read the full data usage agreement'

/** Hardware-back confirm-exit prompt, shown only on the first slide (T1). */
export const EXIT_WARNING_TITLE = 'Leave FeralSpotter?'
export const EXIT_WARNING_BODY =
  "You're about to exit the app. You can pick up right where you left off next time you open FeralSpotter."
