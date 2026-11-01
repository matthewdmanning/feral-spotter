import { computeEntrypointDiameter } from '../entrypointDiameter'

describe('computeEntrypointDiameter', () => {
  it('sizes off the short axis (width), in portrait', () => {
    // 360x800, 7.5% buffer: shortAxis = 360
    // raw = 360 * (1 - 0.15) - 24 = 306 - 24 = 282
    expect(computeEntrypointDiameter(360, 800, 0.075, 24)).toBe(282)
  })

  it('sizes off the short axis (still width), in landscape — orientation-invariant', () => {
    // width is now the longer side (800); the short axis is still 360,
    // so the result matches the portrait case above exactly.
    expect(computeEntrypointDiameter(800, 360, 0.075, 24)).toBe(282)
  })

  it('shrinks toward zero as the buffer percentage grows', () => {
    const small = computeEntrypointDiameter(360, 800, 0.075, 24)
    const large = computeEntrypointDiameter(360, 800, 0.2, 24)
    expect(large).toBeLessThan(small)
  })

  it('never drops below the 48dp touch-target minimum on a narrow screen', () => {
    // shortAxis=200, raw = 200 * (1 - 1.5) - 24 = -100 - 24 = -124 -> floored to 48
    expect(computeEntrypointDiameter(200, 400, 0.75, 24)).toBe(48)
  })
})
