/**
 * lib/insetCrop/diameter.ts
 *
 * Pure sizing formula for the inset-crop bubble (#174, design decided in
 * #168): diameter = (box diagonal + box short side) / 1.6. Larger boxes get
 * proportionally larger bubbles; tiny/distant-cat boxes can compute below
 * the 44-48dp touch-target minimum (docs/references/ux_principles.md #1) —
 * flagged as an open question in #168/#174, not clamped here.
 */

export function computeBubbleDiameter(
  boxWidth: number,
  boxHeight: number,
): number {
  const diagonal = Math.sqrt(boxWidth ** 2 + boxHeight ** 2)
  const shortSide = Math.min(boxWidth, boxHeight)
  return (diagonal + shortSide) / 1.6
}
