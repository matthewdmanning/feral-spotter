/**
 * hooks/useTutorialStore.ts
 * Persisted Zustand store tracking tutorial completion state.
 * `unseen` auto-fires the tutorial on first annotation entry;
 * `skipped` and `completed` suppress it (replay via Settings resets to `unseen`).
 */

import { asyncStorage } from "@/src/lib/cache/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TutorialStatus = "unseen" | "skipped" | "completed";

interface TutorialState {
  annotation_tutorial_status: TutorialStatus;

  setAnnotationTutorialStatus: (status: TutorialStatus) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      annotation_tutorial_status: "unseen",

      setAnnotationTutorialStatus: (status) =>
        set({ annotation_tutorial_status: status }),
    }),
    {
      name: "tutorial-store",
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
