/**
 * config/onboardingCopy.ts
 * Single source of truth for first-run tutorial + consent primer copy.
 * Spec: consent_primers_copy.md / tutorial_copy.md (2026-07-13).
 * Rule: never "tracking" in reference to people — cats only.
 */

export type PrimerKey = "location" | "camera" | "photo_library";

export interface SlideCopy {
  header: string;
  body: readonly string[];
  button: string;
}

export interface PrimerCopy extends SlideCopy {
  deferButton: string;
  denied: { header: string; body: string };
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
    // T3 — data usage agreement. No skip; acceptance is timestamped.
    header: "Your sightings do real work",
    body: [
      "Photos and locations you submit go to a secure research database used by animal rescue groups and ecology researchers — to map colonies, plan TNR trips, and predict where cats will be.",
      "Non-commercial. Never sold. Never used for ads.",
    ],
    button: "I agree — continue",
  },
  {
    header: "Almost ready",
    body: [
      "Next, FeralSpotter will ask for location, camera, and photo access — they're what make sightings possible. Each screen explains exactly what's shared and why.",
    ],
    button: "Set up FeralSpotter",
  },
] as const;

/** Index of the data-usage-agreement slide (explicit accept, no skip). */
export const AGREEMENT_SLIDE_INDEX = 2;

export const DATA_AGREEMENT_LINK_LABEL = "Read the full data usage agreement";

export const PRIMER_SEQUENCE: readonly PrimerKey[] = [
  "location",
  "camera",
  "photo_library",
] as const;

export const PRIMERS: Record<PrimerKey, PrimerCopy> = {
  location: {
    header: "Help put this cat on the map",
    body: [
      "FeralSpotter exists to map feral cats — every sighting's location is what lets rescue volunteers and researchers track colonies, plan TNR trips, and predict where cats will be.",
      // Compliance-critical wording (Play prominent disclosure) — do not soften:
      "When you allow location, your device's coordinates are attached to your sightings and uploaded with your photos to a secure research database. They're shared only with animal rescue and ecology researchers — never sold, never used for ads. This is a non-commercial project.",
      "Without location, sightings can't be mapped, so FeralSpotter needs this to work.",
    ],
    button: "Share location",
    deferButton: "Maybe later",
    denied: {
      header: "FeralSpotter can't record sightings without location.",
      body: "When you're ready, you can enable it in Settings.",
    },
  },
  camera: {
    header: "Snap the cat, help the colony",
    body: [
      "FeralSpotter uses your camera to photograph the cats you spot. A clear shot — an ear tip, a coat pattern — is how volunteers and researchers tell one feral from another.",
      "Photos you take are uploaded at full quality to a secure research database, used only for cat identification and ecology research. Non-commercial, always.",
    ],
    button: "Allow camera",
    deferButton: "Maybe later",
    denied: {
      header: "FeralSpotter can't capture sightings without the camera.",
      body: "When you're ready, you can enable it in Settings.",
    },
  },
  photo_library: {
    header: "Already got a photo of this cat?",
    body: [
      // "only touches the photos you pick" requires the scoped/selected-photos
      // picker (Android 14+ Selected Photos, iOS limited library). Do not
      // request broad media access or this line becomes false.
      "FeralSpotter can attach photos from your library to a sighting — handy when you snapped a feral before opening the app. It only touches the photos you pick.",
      "Selected photos are uploaded at full quality to a secure research database, used only for cat identification and ecology research. Non-commercial, always.",
    ],
    button: "Allow access",
    deferButton: "Maybe later",
    denied: {
      header: "FeralSpotter can't attach photos without library access.",
      body: "When you're ready, you can enable it in Settings.",
    },
  },
} as const;
