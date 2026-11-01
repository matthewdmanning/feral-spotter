import {
  clampTranslate,
  halfExtentOnScreen,
  maxTranslateForScale,
} from '../panClamp'

/**
 * #204: the photo can no longer be panned so far its edge crosses the fixed
 * center crosshair. These three pure functions are the worklet math
 * extracted so it's testable (worklets themselves aren't) — see the clamp
 * derivation comment in panClamp.ts.
 */
describe('pan-clamp math (#204)', () => {
  describe('halfExtentOnScreen', () => {
    it('is half the contain-fit on-screen size at scale=1', () => {
      // A 1000px-wide image contain-fit into a 500-wide canvas -> baseScale 0.5
      // -> on-screen width 500, half-extent 250.
      expect(halfExtentOnScreen(1000, 0.5)).toBe(250)
    })

    it('is 0 for a degenerate zero-size image', () => {
      expect(halfExtentOnScreen(0, 0.5)).toBe(0)
    })
  })

  describe('maxTranslateForScale', () => {
    it('equals the half-extent at scale=1 (no user zoom)', () => {
      expect(maxTranslateForScale(250, 1)).toBe(250)
    })

    it('grows with user zoom — a zoomed-in photo can pan further', () => {
      expect(maxTranslateForScale(250, 2)).toBe(500)
    })

    it('shrinks below the baseline when zoomed out', () => {
      expect(maxTranslateForScale(250, 0.5)).toBe(125)
    })
  })

  describe('clampTranslate', () => {
    it('passes values already within range through unchanged', () => {
      expect(clampTranslate(100, 250)).toBe(100)
      expect(clampTranslate(-100, 250)).toBe(-100)
      expect(clampTranslate(0, 250)).toBe(0)
    })

    it('clamps a translate that would push the edge past center', () => {
      expect(clampTranslate(400, 250)).toBe(250)
      expect(clampTranslate(-400, 250)).toBe(-250)
    })

    it('clamps to exactly the boundary, not past it', () => {
      expect(clampTranslate(250, 250)).toBe(250)
      expect(clampTranslate(250.0001, 250)).toBe(250)
    })
  })

  it('end-to-end: a pinch-zoomed-out photo re-clamps an existing translate', () => {
    // Panned to the limit at scale 1 (translate 250), then pinched out to 0.5x
    // — the old translate (250) now exceeds the new max (125) and must clamp.
    const halfExtent = halfExtentOnScreen(1000, 0.5)
    const oldMax = maxTranslateForScale(halfExtent, 1)
    const existingTranslate = clampTranslate(400, oldMax) // 250, at the limit
    const newMax = maxTranslateForScale(halfExtent, 0.5)
    expect(clampTranslate(existingTranslate, newMax)).toBe(125)
  })
})
