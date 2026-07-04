/**
 * hooks/usePhotoStore.ts
 * Persisted Zustand store for photos attached to the in-progress submission.
 */

import { asyncStorage } from "@/src/lib/cache/storage";
import type { SubmissionPhoto } from "@/src/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type { SubmissionPhoto };

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoState {
  photos: SubmissionPhoto[];

  addPhoto: (photo: SubmissionPhoto) => void;
  addPhotos: (photos: SubmissionPhoto[]) => void;
  removePhoto: (localId: string) => void;
  clearPhotos: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set) => ({
      photos: [],

      addPhoto: (photo) => set((s) => ({ photos: [...s.photos, photo] })),

      addPhotos: (photos) =>
        set((s) => ({ photos: [...s.photos, ...photos] })),

      removePhoto: (localId) =>
        set((s) => ({
          photos: s.photos.filter((p) => p.local_id !== localId),
        })),

      clearPhotos: () => set({ photos: [] }),
    }),
    {
      name: "photo-store",
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
