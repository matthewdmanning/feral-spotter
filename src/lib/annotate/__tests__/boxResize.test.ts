import {
  clampAspectRatio,
  clampHalfExtent,
  maxHalfExtentForBox,
} from '../boxResize'

/**
 * #286: edge-handle box resize. These three pure functions are the worklet
 * math extracted so it's testable (worklets themselves aren't) — see
 * boxResize.ts for the derivation.
 */
describe('box-resize math (#286)', () => {
  describe('clampHalfExtent', () => {
    it('passes values already within range through unchanged', () => {
      expect(clampHalfExtent(100, 48, 300)).toBe(100)
    })

    it('clamps below the minimum', () => {
      expect(clampHalfExtent(10, 48, 300)).toBe(48)
    })

    it('clamps above the maximum', () => {
      expect(clampHalfExtent(500, 48, 300)).toBe(300)
    })
  })

  describe('clampAspectRatio', () => {
    it('passes a ratio already within bounds through unchanged', () => {
      expect(clampAspectRatio(150, 100, 3)).toBe(150)
    })

    it('caps a too-wide ratio to the max, scaled off the fixed axis', () => {
      // changed=400, fixed=100 -> ratio 4, over maxRatio=3
      expect(clampAspectRatio(400, 100, 3)).toBe(300)
    })

    it('caps a too-thin ratio to the min, scaled off the fixed axis', () => {
      // changed=20, fixed=100 -> ratio 0.2, under 1/3
      expect(clampAspectRatio(20, 100, 3)).toBeCloseTo(100 / 3)
    })
  })

  describe('maxHalfExtentForBox', () => {
    it('is bounded by the canvas half when the photo is smaller', () => {
      // photo half-extent 100 at 2x zoom = 200, still under canvas half 300
      expect(maxHalfExtentForBox(300, 100, 2)).toBe(200)
    })

    it('is bounded by the photo half-extent when the photo is smaller than canvas', () => {
      // photo half-extent 100 at 0.5x zoom = 50, under canvas half 300
      expect(maxHalfExtentForBox(300, 100, 0.5)).toBe(50)
    })

    it('falls back to the canvas half for a degenerate zero-size photo', () => {
      expect(maxHalfExtentForBox(300, 0, 1)).toBe(300)
    })
  })
})
