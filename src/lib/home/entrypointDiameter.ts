/**
 * lib/home/entrypointDiameter.ts
 *
 * Pure sizing formula for Home's two circular entrypoint buttons (Take
 * Photos / Upload Photos), arranged along the screen's long axis —
 * side by side in landscape, stacked in portrait. `bufferPercent` sets
 * the gap between the screen's shorter edge and the outer edge of each
 * circle — not the longer edge, so the buffer stays proportional across
 * orientations. The two circles split whatever space remains along the
 * long axis after both buffers and the fixed `gap` between them.
 */

/** Material/HIG touch-target minimum (docs/references/ux_principles.md #1) — a floor for narrow screens the buffer formula alone could shrink below tappable. */
const MIN_TOUCH_TARGET_DP = 48

export function computeEntrypointBuffer(
  screenWidth: number,
  screenHeight: number,
  bufferPercent: number,
): number {
  return Math.min(screenWidth, screenHeight) * bufferPercent
}

export function computeEntrypointDiameter(
  screenWidth: number,
  screenHeight: number,
  bufferPercent: number,
  gap: number,
): number {
  const shortAxis = Math.min(screenWidth, screenHeight)
  const raw = shortAxis * (1 - 2 * bufferPercent) - gap
  return Math.max(raw, MIN_TOUCH_TARGET_DP)
}
