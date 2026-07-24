/**
 * config/onboardingCopy.ts
 * Single source of truth for the first-run tutorial slides.
 * Spec: tutorial_copy.md (2026-07-13).
 * Rule: never "tracking" in reference to people — cats only.
 *
 * Permission priming lives in /consent (eager, on "I Agree") and the
 * contextual re-priming built for #41 (at point of use) — not here.
 */

export interface SlideCopy {
  header: string;
  body: readonly string[];
  button: string;
}

export const TUTORIAL_SLIDES: readonly SlideCopy[] = [
  {
    header: "Every feral counts",
    body: [
      "Every neighborhood has its ferals — and every sighting helps. FeralSpotter turns what you spot into data that rescue volunteers and ecology researchers use to understand feral cats and help them.",
    ],
    button: "Next",
  },
  {
    header: "Spot. Snap. Submit.",
    body: [
      "See a feral? Start a sighting. Take a photo or two, note what you can — ear tip, coat pattern, condition — then review and submit.",
      "About a minute, and every detail helps tell one cat from another.",
    ],
    button: "Next",
  },
  {
    // T3 — informational only. Explicit acceptance happens on /consent,
    // not here (avoid double-gating the same disclosure).
    header: "Your sightings do real work",
    body: [
      "Photos and locations you submit go to a secure research database used by animal rescue groups and ecology researchers — to map colonies, plan TNR trips, and predict where cats will be.",
      "Non-commercial. Never sold. Never used for ads.",
    ],
    button: "Next",
  },
  {
    header: "Almost ready",
    body: [
      "Next, FeralSpotter will ask you to register and grant location, camera, and photo access — each screen explains exactly what's shared and why.",
    ],
    button: "Set up FeralSpotter",
  },
] as const;

/** Index of the data-usage slide — its "Next" links out to the full agreement. */
export const AGREEMENT_SLIDE_INDEX = 2;

export const DATA_AGREEMENT_LINK_LABEL = "Read the full data usage agreement";
