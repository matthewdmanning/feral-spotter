import { computeBubbleDiameter } from '../diameter'

describe('computeBubbleDiameter', () => {
  it('matches the #168 prototype readouts for its mock box sizes', () => {
    expect(computeBubbleDiameter(40, 30)).toBeCloseTo(50, 4)
    expect(computeBubbleDiameter(96, 74)).toBeCloseTo(122.0066, 4)
    expect(computeBubbleDiameter(170, 132)).toBeCloseTo(217.0188, 4)
  })

  it('scales up for a proportionally larger box (story 8)', () => {
    const small = computeBubbleDiameter(40, 30)
    const large = computeBubbleDiameter(170, 132)
    expect(large).toBeGreaterThan(small)
  })

  it('is symmetric in width/height', () => {
    expect(computeBubbleDiameter(96, 74)).toBeCloseTo(
      computeBubbleDiameter(74, 96),
      10,
    )
  })

  it('returns 0 for a degenerate zero-area box', () => {
    expect(computeBubbleDiameter(0, 0)).toBe(0)
  })

  it('a perfect square uses its side as both diagonal input and short side', () => {
    // diag = side*sqrt(2), short = side -> (side*sqrt(2) + side) / 1.6
    const side = 50
    expect(computeBubbleDiameter(side, side)).toBeCloseTo(
      (side * Math.SQRT2 + side) / 1.6,
      10,
    )
  })
})
