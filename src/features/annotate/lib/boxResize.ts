/**
 * lib/annotate/boxResize.ts
 * Pure math for useBoundingBoxFrame's edge-handle resize (#286: the crop box
 * is center-anchored — each handle drag changes its own half-extent
 * (half-width for left/right, half-height for top/bottom), and the opposite
 * edge mirrors automatically since both edges are computed from the same
 * half-extent. Kept separate from panClamp.ts/useBoundingBoxFrame.ts for the
 * same reason: worklets aren't testable in Jest, this math is.
 */

export function clampHalfExtent(
  value: number,
  minHalf: number,
  maxHalf: number,
): number {
  'worklet'
  return Math.min(Math.max(value, minHalf), maxHalf)
}

/**
 * Caps how thin the box can get relative to its other axis (e.g. maxRatio=3
 * forbids anything outside 1:3..3:1) — independent of the absolute-size
 * clamp above.
 */
export function clampAspectRatio(
  changedHalf: number,
  fixedHalf: number,
  maxRatio: number,
): number {
  'worklet'
  const ratio = changedHalf / fixedHalf
  if (ratio > maxRatio) return fixedHalf * maxRatio
  if (ratio < 1 / maxRatio) return fixedHalf / maxRatio
  return changedHalf
}

/**
 * The box can't grow past the photo's own on-screen extent (else its
 * confirmed corners get silently clamped to the image bounds, corrupting the
 * ratio the user just set) — bounded by whichever is smaller, the canvas
 * half or the photo's current half-extent at the live zoom scale.
 */
export function maxHalfExtentForBox(
  canvasHalf: number,
  photoHalfExtent: number,
  scale: number,
): number {
  'worklet'
  if (photoHalfExtent <= 0) return canvasHalf
  return Math.min(canvasHalf, photoHalfExtent * scale)
}
