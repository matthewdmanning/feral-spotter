/**
 * lib/insetCrop/collapse.ts
 *
 * Pure math for the inset-crop bubble's collapse slide (#202 fix to #174's
 * design). The bubble's wrap is right-anchored (`right: theme.spacing.md`)
 * at its *unscaled* layout size; a collapse `scale` transform shrinks it
 * toward that same center point, which pulls its visual right edge inward
 * by half the size delta. `computeCollapsedOffset` is the `translateX`
 * needed to push that visual edge back out to the anchor, so the collapsed
 * bubble docks flush at the screen edge instead of drifting inward (or, at
 * the previous formula's `diameter * 0.62`, overshooting past the edge and
 * off-screen).
 */

export function computeCollapsedOffset(
  diameter: number,
  collapsedDiameter: number,
): number {
  return (diameter - collapsedDiameter) / 2
}
