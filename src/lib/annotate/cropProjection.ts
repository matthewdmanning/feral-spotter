/**
 * lib/annotate/cropProjection.ts
 * Pure math for useBoundingBoxFrame's crop frame <-> normalised BoundingBox
 * projection (#356). Two inverse directions:
 *  - boxForTransform: the live on-screen crop frame -> a normalised
 *    BoundingBox on the original image (confirm).
 *  - transformForBox: a previously-confirmed normalised BoundingBox -> the
 *    pan/zoom transform that reproduces it on screen (resume).
 * Kept separate from useBoundingBoxFrame.ts for the same reason as
 * panClamp.ts/boxResize.ts: that file imports reanimated at module scope,
 * so worklets aren't testable in Jest, but this math isn't a worklet and is.
 *
 * Both directions share the same contain-fit convention: at scale=1,
 * translate=0, the image sits centered in the canvas, scaled down (never up)
 * to fit — see containFit below.
 */

export interface ProjectionDims {
  canvasWidth: number
  canvasHeight: number
  imgNaturalWidth: number
  imgNaturalHeight: number
}

export interface CropTransform {
  scale: number
  translateX: number
  translateY: number
  boxHalfWidth: number
  boxHalfHeight: number
}

export interface NormalisedBox {
  lowerLeftX: number
  lowerLeftY: number
  upperRightX: number
  upperRightY: number
}

function containFit(dims: ProjectionDims) {
  const { canvasWidth, canvasHeight, imgNaturalWidth, imgNaturalHeight } = dims
  const baseScale = Math.min(
    canvasWidth / imgNaturalWidth,
    canvasHeight / imgNaturalHeight,
  )
  const baseOffsetX = (canvasWidth - imgNaturalWidth * baseScale) / 2
  const baseOffsetY = (canvasHeight - imgNaturalHeight * baseScale) / 2
  return { baseScale, baseOffsetX, baseOffsetY }
}

/**
 * Confirm direction: projects the live crop frame (fixed on screen, center-
 * anchored) through the current pan/zoom transform onto the original image,
 * clamped to the image bounds and normalised 0-1.
 */
export function boxForTransform(
  transform: CropTransform,
  dims: ProjectionDims,
): NormalisedBox {
  const { canvasWidth, canvasHeight, imgNaturalWidth, imgNaturalHeight } = dims
  const { scale, translateX, translateY, boxHalfWidth, boxHalfHeight } =
    transform
  const { baseScale, baseOffsetX, baseOffsetY } = containFit(dims)
  const canvasCenterX = canvasWidth / 2
  const canvasCenterY = canvasHeight / 2
  const boxWidth = boxHalfWidth * 2
  const boxHeight = boxHalfHeight * 2
  const boxX = (canvasWidth - boxWidth) / 2
  const boxY = (canvasHeight - boxHeight) / 2

  const toImagePx = (cx: number, cy: number): [number, number] => [
    ((cx - canvasCenterX - translateX) / scale + canvasCenterX - baseOffsetX) /
      baseScale,
    ((cy - canvasCenterY - translateY) / scale + canvasCenterY - baseOffsetY) /
      baseScale,
  ]

  const [x1, y1] = toImagePx(boxX, boxY)
  const [x2, y2] = toImagePx(boxX + boxWidth, boxY + boxHeight)

  const clampX = (v: number) => Math.min(Math.max(v, 0), imgNaturalWidth)
  const clampY = (v: number) => Math.min(Math.max(v, 0), imgNaturalHeight)

  return {
    lowerLeftX: clampX(x1) / imgNaturalWidth,
    lowerLeftY: clampY(y2) / imgNaturalHeight,
    upperRightX: clampX(x2) / imgNaturalWidth,
    upperRightY: clampY(y1) / imgNaturalHeight,
  }
}

/**
 * Resume direction: given a previously-confirmed normalised box, solves the
 * single pan/zoom transform that reproduces it on screen. The box's on-screen
 * size is re-derived from its saved aspect ratio bounded by maxBoxDim (the
 * same default fraction fresh boxes start at) rather than its original
 * on-screen size, which isn't preserved — on-screen pixels deliberately
 * don't round-trip, only the normalised image-space box does.
 * Returns null for a degenerate saved box (zero or negative screen extent).
 */
export function transformForBox(
  box: NormalisedBox,
  dims: ProjectionDims,
  maxBoxDim: number,
): CropTransform | null {
  const { canvasWidth, canvasHeight, imgNaturalWidth, imgNaturalHeight } = dims
  const { baseScale, baseOffsetX, baseOffsetY } = containFit(dims)
  const canvasCenterX = canvasWidth / 2
  const canvasCenterY = canvasHeight / 2

  const cx1 = baseOffsetX + box.lowerLeftX * imgNaturalWidth * baseScale
  const cx2 = baseOffsetX + box.upperRightX * imgNaturalWidth * baseScale
  const cy1 = baseOffsetY + box.upperRightY * imgNaturalHeight * baseScale
  const cy2 = baseOffsetY + box.lowerLeftY * imgNaturalHeight * baseScale

  const boxScreenWidth = cx2 - cx1
  const boxScreenHeight = cy2 - cy1
  if (boxScreenWidth <= 0 || boxScreenHeight <= 0) return null

  const aspect = boxScreenWidth / boxScreenHeight
  const boxWidth = aspect >= 1 ? maxBoxDim : maxBoxDim * aspect
  const boxHeight = aspect >= 1 ? maxBoxDim / aspect : maxBoxDim

  const scale = boxWidth / boxScreenWidth
  const translateX = (canvasCenterX - (cx1 + cx2) / 2) * scale
  const translateY = (canvasCenterY - (cy1 + cy2) / 2) * scale

  return {
    scale,
    translateX,
    translateY,
    boxHalfWidth: boxWidth / 2,
    boxHalfHeight: boxHeight / 2,
  }
}
