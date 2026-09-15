import { boxForTransform, transformForBox } from '../cropProjection'

/**
 * #356: crop-frame <-> normalised BoundingBox projection, extracted from
 * useBoundingBoxFrame so it's testable (worklets aren't) — see the module
 * docstring in cropProjection.ts.
 */
describe('crop projection (#356)', () => {
  // 1000x1000 canvas, 2000x1000 image -> contain-fit baseScale 0.5,
  // image on-screen 1000x500, letterboxed with 250px offset top/bottom.
  const dims = {
    canvasWidth: 1000,
    canvasHeight: 1000,
    imgNaturalWidth: 2000,
    imgNaturalHeight: 1000,
  }

  describe('boxForTransform', () => {
    it('at identity transform, maps the centered crop frame onto the image center', () => {
      const box = boxForTransform(
        {
          scale: 1,
          translateX: 0,
          translateY: 0,
          boxHalfWidth: 200,
          boxHalfHeight: 200,
        },
        dims,
      )
      // Crop frame spans canvas [300,700]x[300,700]. Image occupies canvas
      // y in [250,750] (letterboxed), x in [0,1000] (baseScale 0.5 of 2000).
      // -> image px x in [600,1400], y in [100,900] -> normalised.
      expect(box.lowerLeftX).toBeCloseTo(600 / 2000)
      expect(box.upperRightX).toBeCloseTo(1400 / 2000)
      expect(box.lowerLeftY).toBeCloseTo(900 / 1000)
      expect(box.upperRightY).toBeCloseTo(100 / 1000)
    })

    it('clamps a crop frame that overhangs the image bounds', () => {
      const box = boxForTransform(
        {
          scale: 1,
          translateX: 0,
          translateY: 0,
          boxHalfWidth: 600,
          boxHalfHeight: 600,
        },
        dims,
      )
      expect(box.lowerLeftX).toBe(0)
      expect(box.lowerLeftY).toBe(1)
      expect(box.upperRightX).toBe(1)
      expect(box.upperRightY).toBe(0)
    })
  })

  describe('transformForBox', () => {
    it('returns null for a degenerate (zero-extent) saved box', () => {
      expect(
        transformForBox(
          {
            lowerLeftX: 0.5,
            lowerLeftY: 0.5,
            upperRightX: 0.5,
            upperRightY: 0.5,
          },
          dims,
          850,
        ),
      ).toBeNull()
    })

    it('reconstructs a transform whose on-screen box matches the saved aspect ratio', () => {
      const transform = transformForBox(
        {
          lowerLeftX: 0.3,
          lowerLeftY: 0.9,
          upperRightX: 0.7,
          upperRightY: 0.1,
        },
        dims,
        850,
      )
      expect(transform).not.toBeNull()
      // Saved box is square in image px (800x800 of a 2000x1000 image at
      // baseScale 0.5 -> 400x400 on screen) -> reconstructed box is square,
      // bounded by maxBoxDim.
      expect(transform!.boxHalfWidth).toBeCloseTo(transform!.boxHalfHeight)
      expect(transform!.boxHalfWidth * 2).toBeCloseTo(850)
    })
  })

  it('round-trips confirm -> resume -> confirm to the same normalised box', () => {
    const original = {
      lowerLeftX: 0.2,
      lowerLeftY: 0.85,
      upperRightX: 0.65,
      upperRightY: 0.15,
    }

    const transform = transformForBox(original, dims, 850)
    expect(transform).not.toBeNull()

    const roundTripped = boxForTransform(transform!, dims)

    expect(roundTripped.lowerLeftX).toBeCloseTo(original.lowerLeftX)
    expect(roundTripped.lowerLeftY).toBeCloseTo(original.lowerLeftY)
    expect(roundTripped.upperRightX).toBeCloseTo(original.upperRightX)
    expect(roundTripped.upperRightY).toBeCloseTo(original.upperRightY)
  })
})
