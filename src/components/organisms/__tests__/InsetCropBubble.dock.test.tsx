import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { render } from '@testing-library/react-native'
import { Animated, StyleSheet } from 'react-native'
import { InsetCropBubble } from '../InsetCropBubble'

/**
 * The collapsed bubble docks in its zone's top corner. Collapsing is a scale
 * toward the bubble's center, so a bubble that had grown large left its
 * collapsed self hanging far below the header zone, over the form (the zone
 * reserves only the collapsed size). The failure worth catching is the
 * collapsed top edge landing anywhere but the zone's top.
 */
jest.mock('expo-image', () => ({
  Image: () => null,
}))

// A box covering most of the photo, so the expanded bubble is large.
const BOX = {
  lowerLeftX: 0.05,
  lowerLeftY: 0.95,
  upperRightX: 0.95,
  upperRightY: 0.05,
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
  useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', BOX)
})

const resolved = (value: unknown): number =>
  typeof value === 'number'
    ? value
    : (value as { __getValue: () => number }).__getValue()

describe('InsetCropBubble docking', () => {
  it('docks the collapsed bubble at the top of its zone, however large it grew', () => {
    const { UNSAFE_getAllByType, getByTestId } = render(
      <InsetCropBubble catId="cat-1" edge="top-center" />,
    )
    const diameter = StyleSheet.flatten(
      getByTestId('inset-crop-bubble').props.style,
    ).width as number
    // The inner Animated.View carries the collapse transform.
    const [, collapse] = UNSAFE_getAllByType(Animated.View)
    const transform = StyleSheet.flatten(collapse.props.style).transform as {
      translateY?: unknown
      scale?: unknown
    }[]
    const translateY = resolved(
      transform.find((t) => t.translateY !== undefined)?.translateY,
    )
    const scale = resolved(transform.find((t) => t.scale !== undefined)?.scale)

    // Scale shrinks toward the center, so the top edge moves down by half
    // the lost height; the lift must cancel exactly that.
    const topAfterScale = (diameter * (1 - scale)) / 2
    expect(diameter).toBeGreaterThan(100)
    expect(translateY + topAfterScale).toBeCloseTo(0)
  })
})
