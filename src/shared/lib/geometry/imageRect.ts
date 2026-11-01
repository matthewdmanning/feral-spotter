/**
 * shared/lib/geometry/imageRect.ts
 *
 * Where to draw the full photo inside the inset-crop bubble so the cat's box
 * fills the bubble, centered. Pure: the bubble component owns layout.
 */

interface NormalisedBox {
  lowerLeftX: number
  lowerLeftY: number
  upperRightX: number
  upperRightY: number
}

export interface ImageRect {
  width: number
  height: number
  left: number
  top: number
}

/**
 * The photo's rect, in bubble coordinates, that crops it to `box`.
 * `naturalW`/`naturalH` are the photo's pixel size; until they are known
 * (0), the photo just fills the bubble.
 */
export function bubbleImageRect(
  box: NormalisedBox,
  naturalW: number,
  naturalH: number,
  diameter: number,
): ImageRect {
  if (naturalW <= 0 || naturalH <= 0) {
    return { width: diameter, height: diameter, left: 0, top: 0 }
  }
  const boxCenterX = (box.lowerLeftX + box.upperRightX) / 2
  const boxCenterY = (box.lowerLeftY + box.upperRightY) / 2
  const boxWidthPx = (box.upperRightX - box.lowerLeftX) * naturalW
  const boxHeightPx = (box.lowerLeftY - box.upperRightY) * naturalH
  // A degenerate (zero-area) box would divide by zero — fall back to
  // showing the full frame around the box's center instead of NaN styles.
  const scale =
    boxWidthPx > 0 && boxHeightPx > 0
      ? Math.max(diameter / boxWidthPx, diameter / boxHeightPx)
      : Math.min(diameter / naturalW, diameter / naturalH)
  const width = naturalW * scale
  const height = naturalH * scale
  return {
    width,
    height,
    left: diameter / 2 - boxCenterX * width,
    top: diameter / 2 - boxCenterY * height,
  }
}
