/**
 * hooks/useBoundingBoxStore.ts
 *
 * Persisted Zustand store for bounding-box annotations.
 * Keyed by `${cat_id}:${photo_local_id}` so data survives
 * navigation and app restarts.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import type { BoundingBox } from '@/src/types/BoundingBox'
import { randomUUID } from 'expo-crypto'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

type BoxInput = Omit<BoundingBox, 'id' | 'cat_id' | 'photo_local_id'>

interface BoundingBoxState {
  /** Record keyed by `${cat_id}:${photo_local_id}` */
  boxes: Record<string, BoundingBox[]>
  /** Box replaced by the most recent addBox call, per key — for a future "revert" affordance */
  lastBoxes: Record<string, BoundingBox | undefined>
  /** Explicit "cat not in this photo" markers, same key scheme as boxes. Mutually exclusive with boxes: whichever of addBox/markAbsent runs last for a key wins, clearing the other. */
  absences: Record<string, true>

  addBox: (catId: string, photoId: string, box: BoxInput) => void
  removeBox: (catId: string, photoId: string, boxId: string) => void
  markAbsent: (catId: string, photoId: string) => void
  getBoxes: (catId: string, photoId: string) => BoundingBox[]
  clearForCat: (catId: string) => void
  /** Store-wide wipe — draft teardown only, see lib/submission/draft.ts (#292) */
  clearAll: () => void
  /** Returns every box for a photo across all cats — for display-only views */
  getBoxesForPhoto: (photoId: string) => BoundingBox[]
  /** Sweeps boxes/absences/lastBoxes for a removed photo, across every cat (#177) */
  removeBoxesForPhoto: (photoId: string) => void
  /** photo_local_ids with a box for this cat — the derived source of ObservedCat.photo_local_ids (#172) */
  getBoxedPhotoIds: (catId: string) => string[]
  /** Every box drawn for this cat, across all its photos — for #264's submit payload */
  getBoxesForCat: (catId: string) => BoundingBox[]
  /** The cat's first-drawn box (by key insertion order) — persists as the Cat Form inset crop (#172) */
  getFirstBox: (catId: string) => BoundingBox | undefined
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBoundingBoxStore = create<BoundingBoxState>()(
  persist(
    (set, get) => ({
      boxes: {},
      lastBoxes: {},
      absences: {},

      // One box per cat+photo — drawing a new box replaces the old one, and
      // clears any absence marker for the same slot (mutually exclusive).
      addBox: (catId, photoId, box) => {
        const key = `${catId}:${photoId}`
        const entry: BoundingBox = {
          ...box,
          id: randomUUID(),
          cat_id: catId,
          photo_local_id: photoId,
        }
        set((s) => {
          const absences = { ...s.absences }
          delete absences[key]
          return {
            boxes: {
              ...s.boxes,
              [key]: [entry],
            },
            lastBoxes: {
              ...s.lastBoxes,
              [key]: s.boxes[key]?.[0],
            },
            absences,
          }
        })
      },

      removeBox: (catId, photoId, boxId) => {
        const key = `${catId}:${photoId}`
        set((s) => ({
          boxes: {
            ...s.boxes,
            [key]: (s.boxes[key] ?? []).filter((b) => b.id !== boxId),
          },
        }))
      },

      // Marks the cat explicitly absent from this photo, clearing any box
      // drawn for the same slot (mutually exclusive with addBox).
      markAbsent: (catId, photoId) => {
        const key = `${catId}:${photoId}`
        set((s) => {
          const boxes = { ...s.boxes }
          delete boxes[key]
          return {
            boxes,
            absences: { ...s.absences, [key]: true },
          }
        })
      },

      getBoxes: (catId, photoId) => {
        const key = `${catId}:${photoId}`
        return get().boxes[key] ?? []
      },

      clearAll: () => set({ boxes: {}, lastBoxes: {}, absences: {} }),

      // Sweeps all three maps, like removeBoxesForPhoto does in the other
      // direction — leaving lastBoxes behind would keep a removed cat's
      // geometry alive under its own key (#304).
      clearForCat: (catId) => {
        set((s) => {
          const prefix = `${catId}:`
          const boxes = { ...s.boxes }
          const absences = { ...s.absences }
          const lastBoxes = { ...s.lastBoxes }
          for (const key of Object.keys(boxes)) {
            if (key.startsWith(prefix)) delete boxes[key]
          }
          for (const key of Object.keys(absences)) {
            if (key.startsWith(prefix)) delete absences[key]
          }
          for (const key of Object.keys(lastBoxes)) {
            if (key.startsWith(prefix)) delete lastBoxes[key]
          }
          return { boxes, absences, lastBoxes }
        })
      },

      getBoxesForPhoto: (photoId) => {
        const all = get().boxes
        return Object.entries(all)
          .filter(([key]) => key.endsWith(`:${photoId}`))
          .flatMap(([, boxes]) => boxes)
      },

      // A photo removed mid-pass (useAnnotatePass.handleLongPressRemove) can
      // carry boxes for more than one cat — sweep every cat's entry for this
      // photo, not just the active one.
      removeBoxesForPhoto: (photoId) => {
        set((s) => {
          const suffix = `:${photoId}`
          const boxes = { ...s.boxes }
          const absences = { ...s.absences }
          const lastBoxes = { ...s.lastBoxes }
          for (const key of Object.keys(boxes)) {
            if (key.endsWith(suffix)) delete boxes[key]
          }
          for (const key of Object.keys(absences)) {
            if (key.endsWith(suffix)) delete absences[key]
          }
          for (const key of Object.keys(lastBoxes)) {
            if (key.endsWith(suffix)) delete lastBoxes[key]
          }
          return { boxes, absences, lastBoxes }
        })
      },

      getBoxedPhotoIds: (catId) => {
        const all = get().boxes
        return Object.entries(all)
          .filter(
            ([key, boxes]) => key.startsWith(`${catId}:`) && boxes.length > 0,
          )
          .map(([key]) => key.slice(`${catId}:`.length))
      },

      getBoxesForCat: (catId) => {
        const all = get().boxes
        return Object.entries(all)
          .filter(([key]) => key.startsWith(`${catId}:`))
          .flatMap(([, boxes]) => boxes)
      },

      // Object key insertion order == box-confirmation order, since addBox
      // only ever assigns new keys or overwrites an existing key in place.
      // Skips keys left empty by removeBox — those aren't "the first box"
      // anymore, they're a removed one.
      getFirstBox: (catId) => {
        const all = get().boxes
        const firstKey = Object.keys(all).find(
          (key) => key.startsWith(`${catId}:`) && (all[key]?.length ?? 0) > 0,
        )
        return firstKey ? all[firstKey]?.[0] : undefined
      },
    }),
    {
      name: 'bounding-box-store',
      storage: createJSONStorage(() => asyncStorage),
      // v1 -> v2: BoundingBox shape changed from x/y/width/height (canvas-relative)
      // to lowerLeft/upperRight corners (image-pixel-relative) — old data is incompatible, drop it.
      version: 2,
      migrate: () => ({ boxes: {}, lastBoxes: {}, absences: {} }),
    },
  ),
)
