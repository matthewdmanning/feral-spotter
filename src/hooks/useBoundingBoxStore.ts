/**
 * hooks/useBoundingBoxStore.ts
 *
 * Persisted Zustand store for bounding-box annotations.
 * Keyed by `${cat_id}:${photo_local_id}` so data survives
 * navigation and app restarts.
 *
 * Separate from useAnnotationStore to avoid touching
 * the unmigrated store file.
 */

import { mmkvStorage } from "@/src/lib/cache/storage";
import type { BoundingBox } from "@/src/types/BoundingBox";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

type BoxInput = Omit<BoundingBox, "id" | "cat_id" | "photo_local_id">;

interface BoundingBoxState {
  /** Record keyed by `${cat_id}:${photo_local_id}` */
  boxes: Record<string, BoundingBox[]>;

  addBox: (catId: string, photoId: string, box: BoxInput) => void;
  removeBox: (catId: string, photoId: string, boxId: string) => void;
  getBoxes: (catId: string, photoId: string) => BoundingBox[];
  clearForCat: (catId: string) => void;
  /** Returns every box for a photo across all cats — for display-only views */
  getBoxesForPhoto: (photoId: string) => BoundingBox[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBoundingBoxStore = create<BoundingBoxState>()(
  persist(
    (set, get) => ({
      boxes: {},

      addBox: (catId, photoId, box) => {
        const key = `${catId}:${photoId}`;
        const entry: BoundingBox = {
          ...box,
          id: nanoid(),
          cat_id: catId,
          photo_local_id: photoId,
        };
        set((s) => ({
          boxes: {
            ...s.boxes,
            [key]: [...(s.boxes[key] ?? []), entry],
          },
        }));
      },

      removeBox: (catId, photoId, boxId) => {
        const key = `${catId}:${photoId}`;
        set((s) => ({
          boxes: {
            ...s.boxes,
            [key]: (s.boxes[key] ?? []).filter((b) => b.id !== boxId),
          },
        }));
      },

      getBoxes: (catId, photoId) => {
        const key = `${catId}:${photoId}`;
        return get().boxes[key] ?? [];
      },

      clearForCat: (catId) => {
        set((s) => {
          const next = { ...s.boxes };
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${catId}:`)) delete next[key];
          }
          return { boxes: next };
        });
      },

      getBoxesForPhoto: (photoId) => {
        const all = get().boxes;
        return Object.entries(all)
          .filter(([key]) => key.endsWith(`:${photoId}`))
          .flatMap(([, boxes]) => boxes);
      },
    }),
    {
      name: "bounding-box-store",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
