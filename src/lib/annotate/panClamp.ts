/**
 * lib/annotate/panClamp.ts
 * Pure math for useBoundingBoxFrame's pan-clamp (#204: the photo can't be
 * dragged so far its edge crosses the fixed center crosshair). Kept in its
 * own module with no reanimated/gesture-handler import — worklets aren't
 * testable in Jest (no native init), but this math is, and useBoundingBoxFrame.ts
 * imports reanimated at module scope, which would drag that failure in too.
 *
 * Derivation: at scale=1/translate=0 the image sits contain-fit in the
 * canvas, so its on-screen half-extent from its own center is
 * (imgSize * baseScale) / 2; user scale multiplies that; user translate
 * moves the image's center away from the canvas center. The canvas center
 * (crosshair) stays inside the image's bounds exactly while
 * |translate| <= scale * halfExtent — matches handleConfirm's toImagePx
 * screen<->image convention in useBoundingBoxFrame.ts.
 */

export function halfExtentOnScreen(imgSize: number, baseScale: number): number {
  'worklet'
  return (imgSize * baseScale) / 2
}

export function maxTranslateForScale(
  halfExtent: number,
  scale: number,
): number {
  'worklet'
  return halfExtent * scale
}

export function clampTranslate(value: number, maxAbs: number): number {
  'worklet'
  return Math.min(Math.max(value, -maxAbs), maxAbs)
}
