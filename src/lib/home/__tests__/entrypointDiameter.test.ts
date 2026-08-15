import { computeEntrypointDiameter } from '../entrypointDiameter'

describe('computeEntrypointDiameter', () => {
  it('derives the buffer from the shorter side, in portrait', () => {
    // 360x800, 7.5% buffer, 24 gap: buffer = 27, diameter = (360-54-24)/2 = 141
    expect(computeEntrypointDiameter(360, 800, 0.075, 24)).toBe(141)
  })

  it('derives the buffer from the shorter side, in landscape', () => {
    // width is now the longer side (800); shorter side is still 360, so
    // the buffer (27) is identical to the portrait case above.
    expect(computeEntrypointDiameter(800, 360, 0.075, 24)).toBe(
      (800 - 54 - 24) / 2,
    )
  })

  it('shrinks toward zero as the buffer percentage grows', () => {
    const small = computeEntrypointDiameter(360, 800, 0.075, 24)
    const large = computeEntrypointDiameter(360, 800, 0.2, 24)
    expect(large).toBeLessThan(small)
  })

  it('never drops below the 48dp touch-target minimum on a narrow screen', () => {
    expect(computeEntrypointDiameter(200, 400, 0.3, 24)).toBe(48)
  })
})
