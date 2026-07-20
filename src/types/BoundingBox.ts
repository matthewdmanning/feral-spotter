/**
 * types/BoundingBox.ts
 * Bounding-box annotation types.
 * Corners are normalised (0-1) relative to the original image pixel dimensions
 * (not the screen/canvas — the crop square is fixed on screen, the photo pans/zooms under it).
 * Screen-space y grows downward: "lower" = visually bottom (larger y), "upper" = visually top (smaller y).
 */

export interface BoundingBox {
  id:             string   // expo-crypto randomUUID
  cat_id:         string
  photo_local_id: string
  /** Bottom-left corner, normalised 0-1 */
  lowerLeftX:  number
  lowerLeftY:  number
  /** Top-right corner, normalised 0-1 */
  upperRightX: number
  upperRightY: number
}
