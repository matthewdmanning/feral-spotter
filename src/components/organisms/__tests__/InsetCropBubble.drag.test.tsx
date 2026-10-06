import { act, fireEvent, render } from '@testing-library/react-native'
import { Animated, StyleSheet } from 'react-native'
import { InsetCropBubble } from '../InsetCropBubble'

/**
 * A drag owns the touch from the pan responder's grant to its release. The
 * host locks page scroll for exactly that span, so a stuck `held` makes the
 * page unscrollable. A dropped bubble slides to the right edge, keeping only
 * its new height, so it never rests over the subheader text.
 */
jest.mock('expo-image', () => ({
  Image: () => null,
}))

const BOX = {
  id: 'box-1',
  cat_id: 'cat-1',
  photo_local_id: 'photo-1',
  lowerLeftX: 0.4,
  lowerLeftY: 0.55,
  upperRightX: 0.6,
  upperRightY: 0.45,
}

jest.mock('@/src/hooks', () => ({
  usePhotoStore: (
    sel: (s: { photos: { local_id: string; uri: string }[] }) => unknown,
  ) => sel({ photos: [{ local_id: 'photo-1', uri: 'file://photo-1.jpg' }] }),
}))

jest.mock('@/src/hooks/useBoundingBoxStore', () => ({
  useBoundingBoxStore: (
    sel: (s: { getFirstBox: (catId: string) => typeof BOX }) => unknown,
  ) => sel({ getFirstBox: () => BOX }),
}))

const resolved = (value: unknown): number =>
  (value as { __getValue: () => number }).__getValue()

const touch = (x: number, y: number) => ({
  touchHistory: {
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: 1,
    numberActiveTouches: 1,
    touchBank: [
      {
        touchActive: true,
        startPageX: 0,
        startPageY: 0,
        startTimeStamp: 0,
        currentPageX: x,
        currentPageY: y,
        currentTimeStamp: 1,
        previousPageX: 0,
        previousPageY: 0,
        previousTimeStamp: 0,
      },
    ],
  },
})

describe('InsetCropBubble drag', () => {
  it('holds from grant to release and snaps right, keeping the new height', () => {
    jest.useFakeTimers()
    const onHoldChange = jest.fn()
    const { UNSAFE_getAllByType, getByTestId } = render(
      <InsetCropBubble
        catId="cat-1"
        edge="top-center"
        draggable
        onHoldChange={onHoldChange}
      />,
    )
    // Expand first: a collapsed bubble already rests at the right edge.
    fireEvent.press(getByTestId('inset-crop-bubble'))
    act(() => jest.advanceTimersByTime(300))
    const [wrap] = UNSAFE_getAllByType(Animated.View)

    expect(onHoldChange).not.toHaveBeenCalled()
    act(() => {
      wrap.props.onResponderGrant(touch(0, 0))
      wrap.props.onResponderMove(touch(-120, 200))
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(true)

    act(() => {
      wrap.props.onResponderRelease(touch(-120, 200))
      jest.advanceTimersByTime(300)
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(false)
    const [{ translateX }, { translateY }] = StyleSheet.flatten(
      wrap.props.style,
    ).transform as { translateX?: unknown; translateY?: unknown }[]
    expect(resolved(translateY)).toBeCloseTo(200)
    // Right edge, not the centered spot the expanded bubble started at.
    expect(resolved(translateX)).toBeGreaterThan(0)
    jest.useRealTimers()
  })

  it('collapses a dragged bubble in place instead of returning it to its dock', () => {
    jest.useFakeTimers()
    const { UNSAFE_getAllByType, getByTestId } = render(
      <InsetCropBubble catId="cat-1" edge="top-center" draggable />,
    )
    fireEvent.press(getByTestId('inset-crop-bubble'))
    act(() => jest.advanceTimersByTime(300))
    const [wrap] = UNSAFE_getAllByType(Animated.View)
    act(() => {
      wrap.props.onResponderGrant(touch(0, 0))
      wrap.props.onResponderMove(touch(0, 200))
      wrap.props.onResponderRelease(touch(0, 200))
      jest.advanceTimersByTime(300)
    })
    fireEvent.press(getByTestId('inset-crop-bubble'))
    act(() => jest.advanceTimersByTime(300))
    const [{ translateX }, { translateY }] = StyleSheet.flatten(
      wrap.props.style,
    ).transform as { translateX?: unknown; translateY?: unknown }[]
    expect(getByTestId('inset-crop-bubble').props.accessibilityLabel).toMatch(
      /^Expand/,
    )
    expect(resolved(translateY)).toBeCloseTo(200)
    expect(resolved(translateX)).toBeCloseTo(0)
    jest.useRealTimers()
  })
})
