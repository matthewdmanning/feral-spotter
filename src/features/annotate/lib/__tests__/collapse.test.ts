import { computeCollapsedOffset } from '../collapse'

describe('computeCollapsedOffset', () => {
  it('is zero when the bubble never expands past the collapsed size', () => {
    expect(computeCollapsedOffset(68, 68)).toBe(0)
  })

  it('grows with the gap between expanded and collapsed diameter', () => {
    expect(computeCollapsedOffset(120, 68)).toBe(26)
    expect(computeCollapsedOffset(220, 68)).toBe(76)
  })

  it('is half the diameter delta, not the previous 0.62-of-diameter formula', () => {
    // Regression guard for #202: the prior `diameter * 0.62` formula
    // overshot the right-edge anchor and pushed the collapsed bubble
    // off-screen. This must track (diameter - collapsed) / 2 instead.
    const diameter = 150
    const collapsed = 68
    expect(computeCollapsedOffset(diameter, collapsed)).toBe(
      (diameter - collapsed) / 2,
    )
    expect(computeCollapsedOffset(diameter, collapsed)).not.toBeCloseTo(
      diameter * 0.62,
      0,
    )
  })
})
