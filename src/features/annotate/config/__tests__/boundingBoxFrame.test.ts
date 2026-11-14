import {
  MAX_MIN_FRAMED_HALF_EXTENT,
  MAX_SCALE,
  MIN_HALF_EXTENT,
} from '@/src/features/annotate/config/boundingBoxFrame'

/**
 * #457: the box floor is fixed on screen, so framing a distant cat relies on
 * zoom. Catches a hitbox/inset bump or a MAX_SCALE cut that silently makes
 * small cats unframable again.
 */
describe('bounding-box frame tunables (#457)', () => {
  it('lets a fully zoomed-in box frame a small enough photo region', () => {
    expect(MIN_HALF_EXTENT / MAX_SCALE).toBeLessThanOrEqual(
      MAX_MIN_FRAMED_HALF_EXTENT,
    )
  })
})
