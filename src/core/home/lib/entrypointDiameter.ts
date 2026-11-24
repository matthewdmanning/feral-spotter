/**
 * core/home/lib/entrypointDiameter.ts
 *
 * Pure sizing formula for Home's two circular entrypoint buttons (Take
 * Photos / Upload Photos), arranged along the screen's long axis —
 * side by side in landscape, stacked in portrait. `bufferPercent` sets
 * the gap between the screen's shorter edge and the outer edge of each
 * circle — not the longer edge, so the buffer stays proportional across
 * orientations. The two circles split whatever space remains along the
 * long axis after both buffers and the fixed `gap` between them.
 *
 * NAV-8: when the area left for the circles is measured (the footer takes
 * the rest), both circles and `minGap` must also fit in it.
 */

/** Material/HIG touch-target minimum (docs/agents/ui-ux/reference/ux_principles.md #1) — a floor for narrow screens the buffer formula alone could shrink below tappable. */
const MIN_TOUCH_TARGET_DP = 48

export interface EntrypointArea {
  width: number
  height: number
  /** Least space kept between the two circles. */
  minGap: number
}

export function computeEntrypointDiameter(
  screenWidth: number,
  screenHeight: number,
  bufferPercent: number,
  gap: number,
  area?: EntrypointArea,
): number {
  const shortAxis = Math.min(screenWidth, screenHeight)
  let raw = shortAxis * (1 - 2 * bufferPercent) - gap
  if (area) {
    const stacked = screenWidth < screenHeight
    const along = stacked ? area.height : area.width
    const across = stacked ? area.width : area.height
    raw = Math.min(raw, (along - area.minGap) / 2, across)
  }
  return Math.max(raw, MIN_TOUCH_TARGET_DP)
}
