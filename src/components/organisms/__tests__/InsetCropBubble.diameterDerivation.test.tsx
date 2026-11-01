import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { render } from '@testing-library/react-native'
import { StyleSheet, Dimensions } from 'react-native'
import { InsetCropBubble } from '../InsetCropBubble'
import { computeBubbleDiameter } from '@/src/lib/insetCrop/diameter'

/**
 * Pins the normalized-box -> dp -> diameter derivation, not just the pure
 * formula (src/lib/insetCrop/__tests__/diameter.test.ts covers that in
 * isolation). A prior draft scaled the box's width fraction by the
 * window's width and its height fraction by the window's height —
 * anisotropic, since those two dimensions differ on a real phone —
 * silently distorting the box's aspect ratio before it reached a formula
 * that's sensitive to it (min-side + diagonal). This test fails on that
 * regression even though the pure-function test above doesn't.
 *
 * Reads the jest environment's real `Dimensions.get('window')` rather than
 * mocking it — the component reads it once at module-load time (before an
 * import-hoisted `jest.spyOn` could intercept it), so this test computes
 * its expectation from whatever value actually reached the component
 * instead of fighting that ordering.
 */
jest.mock('expo-image', () => ({
  Image: () => null,
}))

// A box whose width and height fractions are equal (0.2 of the photo on
// both axes) — under isotropic scaling this must produce a diameter equal
// to computeBubbleDiameter(78, 78), not some other value that depends on
// window.height leaking into the height axis.
const SQUARE_FRACTION_BOX = {
  lowerLeftX: 0.1,
  lowerLeftY: 0.7,
  upperRightX: 0.3,
  upperRightY: 0.5,
}

beforeEach(() => {
  usePhotoStore.setState({
    ...usePhotoStore.getInitialState(),
    photos: [
      {
        local_id: 'photo-1',
        uri: 'file://photo-1.jpg',
        width: 1000,
        height: 1000,
        uploaded: false,
        upload_progress: 0,
      },
    ],
  })
  useBoundingBoxStore.setState(useBoundingBoxStore.getInitialState())
  // Another cat is seeded first so an unfiltered first-box lookup is observable.
  useBoundingBoxStore.getState().addBox('cat-2', 'photo-1', {
    lowerLeftX: 0.1,
    lowerLeftY: 0.9,
    upperRightX: 0.9,
    upperRightY: 0.1,
  })
  useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', SQUARE_FRACTION_BOX)
})

describe('InsetCropBubble — normalized box -> dp derivation', () => {
  it('scales both box axes by the same window dimension (isotropic)', () => {
    const { getByTestId, rerender } = render(
      <InsetCropBubble catId="cat-1" edge="top-right" />,
    )
    const bubble = getByTestId('inset-crop-bubble')
    const flattened = StyleSheet.flatten(bubble.props.style) as {
      width: number
    }

    const { width: realWidth, height: realHeight } = Dimensions.get('window')
    // This repo's jest environment mocks a real width/height pair that
    // differ from each other — required for this test to distinguish
    // isotropic from anisotropic scaling at all.
    expect(realWidth).not.toBe(realHeight)

    const boxWidthDp = (0.3 - 0.1) * realWidth // fraction 0.2
    const boxHeightDp = (0.7 - 0.5) * realWidth // same fraction, same reference as width
    const expectedDiameter = computeBubbleDiameter(boxWidthDp, boxHeightDp)

    expect(flattened.width).toBeCloseTo(expectedDiameter, 4)

    // Regression guard: if the height axis were ever scaled by
    // window.height instead, the diameter would land here instead —
    // pin that this wrong value is NOT what's rendered.
    const anisotropicWrongDiameter = computeBubbleDiameter(
      boxWidthDp,
      (0.7 - 0.5) * realHeight,
    )
    expect(flattened.width).not.toBeCloseTo(anisotropicWrongDiameter, 4)

    // Switching cats must resolve that cat's box, rather than reusing the
    // previous cat or whichever box happened to be inserted first.
    rerender(<InsetCropBubble catId="cat-2" edge="top-right" />)
    const otherDiameter = StyleSheet.flatten(
      getByTestId('inset-crop-bubble').props.style,
    ).width as number
    expect(otherDiameter).toBeCloseTo(
      computeBubbleDiameter((0.9 - 0.1) * realWidth, (0.9 - 0.1) * realWidth),
      4,
    )
    expect(otherDiameter).not.toBeCloseTo(expectedDiameter, 4)
  })
})
