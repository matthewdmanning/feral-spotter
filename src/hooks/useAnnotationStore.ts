/**
 * hooks/useAnnotationStore.ts
 * Persisted Zustand store tracking, per photo, which cats have a
 * confirmed annotation on it — used to warn before removing a photo
 * that's annotated for more than one cat.
 */

import { mmkvStorage } from "@/src/lib/cache/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Annotation {
  entity_id?: string;
}

export interface AnnotationSet {
  annotations: Annotation[];
}

interface AnnotationState {
  /** Record keyed by photo `local_id` */
  annotationSets: Record<string, AnnotationSet>;

  removeAnnotationSet: (photoLocalId: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      annotationSets: {},

      removeAnnotationSet: (photoLocalId) =>
        set((s) => {
          const next = { ...s.annotationSets };
          delete next[photoLocalId];
          return { annotationSets: next };
        }),
    }),
    {
      name: "annotation-store",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
