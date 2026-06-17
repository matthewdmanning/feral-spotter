/**
 * types/BoundingBox.ts
 * Bounding-box annotation types.
 * Coordinates are normalised (0–1) relative to the canvas / image area.
 */

export interface BoundingBox {
  id:             string   // nanoid
  cat_id:         string
  photo_local_id: string
  /** Left edge, normalised 0–1 */
  x:      number
  /** Top edge, normalised 0–1 */
  y:      number
  /** Width, normalised 0–1 */
  width:  number
  /** Height, normalised 0–1 */
  height: number
}
