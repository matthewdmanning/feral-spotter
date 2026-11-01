/**
 * lib/submission/profilePhoto.ts
 * Which box is a cat's Profile Pic, and the history-cache snapshot of it.
 *
 * Rule: the box on the photo the user chose; else the cat's first box. A
 * choice that no longer has a box (its photo was removed, or the box was
 * redrawn as "not in this photo") falls back the same way — a stale choice
 * must never blank the Profile Pic.
 *
 * Pure: callers pass boxes in from useBoundingBoxStore.
 */

import type {
  CachedCat,
  CachedProfileBox,
} from '@/src/lib/cache/submissionCache'
import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
import type { BoundingBox } from '@/src/types/BoundingBox'

/** `boxes` in confirmation order — getBoxesForCat's order. */
export function resolveProfileBox(
  boxes: BoundingBox[],
  chosenPhotoId: string | undefined,
): BoundingBox | undefined {
  const chosen = chosenPhotoId
    ? boxes.find((b) => b.photo_local_id === chosenPhotoId)
    : undefined
  return chosen ?? boxes[0]
}

function toCachedBox(box: BoundingBox): CachedProfileBox {
  return {
    photo_local_id: box.photo_local_id,
    lowerLeftX: box.lowerLeftX,
    lowerLeftY: box.lowerLeftY,
    upperRightX: box.upperRightX,
    upperRightY: box.upperRightY,
  }
}

/** The cat as stored in history, with its Profile Pic resolved. */
export function toCachedCat(cat: ObservedCat, boxes: BoundingBox[]): CachedCat {
  const profile = resolveProfileBox(boxes, cat.profile_photo_local_id)
  return {
    ...cat,
    profile_photo_local_id: profile?.photo_local_id,
    ...(profile && { profile_box: toCachedBox(profile) }),
  }
}
