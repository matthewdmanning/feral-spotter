/**
 * config/tutorial.ts
 * Step content for the annotation tutorial overlay.
 * Copy is draft — see docs/design/2026-07-14-annotation-tutorial-spec.md.
 */

import type { TutorialStep } from "@/src/components/organisms/TutorialOverlay";

export const ANNOTATION_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Quick annotation walkthrough",
    body: "Annotations teach the system what a cat looks like. This takes about a minute.",
    primaryLabel: "Start",
  },
  {
    id: "draw",
    title: "Draw a box",
    body: "Drag to draw a box around the cat. Get the whole body inside.",
    primaryLabel: "Next",
  },
  {
    id: "adjust",
    title: "Tighten it up",
    body: "Drag a corner to fit the box to the cat's edges.",
    primaryLabel: "Next",
  },
  {
    id: "label",
    title: "Add details",
    body: "Pick what you see. Ear-tip = already neutered — it matters.",
    primaryLabel: "Next",
  },
  {
    id: "done",
    title: "That's it",
    body: "Annotations save automatically with your submission. Replay this anytime from Settings.",
    primaryLabel: "Finish",
  },
];
