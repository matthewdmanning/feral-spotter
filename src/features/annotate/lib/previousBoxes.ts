/**
 * features/annotate/lib/previousBoxes.ts
 *
 * Which boxes on a photo belong to cats already recorded, for drawing them
 * under the crop frame in each cat's own color. Pure: the stores own state.
 */

import type { BoundingBox } from '@/src/shared/types/BoundingBox'

export interface PreviousBox {
  box: BoundingBox
  /** The cat's palette slot, or undefined if it has none yet. */
  colorSlot: number | undefined
}

/**
 * Boxes on `photoId` for every saved cat except the active one. Only saved
 * cats count: an abandoned pass's leftover boxes are not previous cats.
 * Box keys are `${catId}:${photoId}`, as in useBoundingBoxStore.
 */
export function previousCatBoxes(
  savedCatIds: string[],
  activeCatId: string | null,
  photoId: string,
  boxes: Record<string, BoundingBox[]>,
  catColors: Record<string, number>,
): PreviousBox[] {
  return savedCatIds
    .filter((catId) => catId !== activeCatId)
    .flatMap((catId) =>
      (boxes[`${catId}:${photoId}`] ?? []).map((box) => ({
        box,
        colorSlot: catColors[catId],
      })),
    )
}
