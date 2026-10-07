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
    sel: (s: {
      getFirstBox: (catId: string) => typeof BOX
      catColors: Record<string, number>
    }) => unknown,
  ) => sel({ getFirstBox: () => BOX, catColors: {} }),
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

type Handlers = Record<string, (e: unknown) => unknown>

function renderBubble(onHoldChange?: (held: boolean) => void) {
  jest.useFakeTimers()
  const utils = render(
    <InsetCropBubble
      catId="cat-1"
      edge="top-center"
      draggable
      onHoldChange={onHoldChange}
    />,
  )
  // The wrapper carries the drag transform; the inner view takes the touches.
  const [wrap, inner] = utils.UNSAFE_getAllByType(Animated.View)
  const toggle = () => {
    fireEvent.press(utils.getByTestId('inset-crop-bubble'))
    act(() => jest.advanceTimersByTime(300))
  }
  const position = () => {
    const [{ translateX }, { translateY }] = StyleSheet.flatten(
      wrap.props.style,
    ).transform as { translateX?: unknown; translateY?: unknown }[]
    return { x: resolved(translateX), y: resolved(translateY) }
  }
  const touches = inner.props as Handlers
  const drag = (end: 'onResponderRelease' | 'onResponderTerminate') => {
    act(() => {
      touches.onResponderGrant(touch(0, 0))
      touches.onResponderMove(touch(-90, 200))
      touches[end](touch(-90, 200))
      jest.advanceTimersByTime(300)
    })
  }
  // Handlers are rebuilt when the bubble expands, so read them live.
  const liveTouches = () =>
    utils.UNSAFE_getAllByType(Animated.View)[1].props as Handlers
  return {
    wrap,
    touches,
    liveTouches,
    toggle,
    position,
    drag,
    unmount: utils.unmount,
  }
}

afterEach(() => jest.useRealTimers())

describe('InsetCropBubble drag', () => {
  it('holds from grant to release and keeps the dropped height at the dock column', () => {
    const onHoldChange = jest.fn()
    const { touches, position } = renderBubble(onHoldChange)

    expect(onHoldChange).not.toHaveBeenCalled()
    act(() => {
      touches.onResponderGrant(touch(0, 0))
      touches.onResponderMove(touch(-90, 200))
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(true)

    act(() => {
      touches.onResponderRelease(touch(-90, 200))
      jest.advanceTimersByTime(300)
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(false)
    expect(position().y).toBeCloseTo(200)
    // Slid back to the right edge; only the height changed.
    expect(position().x).toBeCloseTo(0)
  })

  it('keeps a dragged bubble’s height through expand and collapse', () => {
    const { touches, toggle, position } = renderBubble()
    act(() => {
      touches.onResponderGrant(touch(0, 0))
      touches.onResponderMove(touch(0, 200))
      touches.onResponderRelease(touch(0, 200))
      jest.advanceTimersByTime(300)
    })
    toggle()
    toggle()
    expect(position().y).toBeCloseTo(200)
    expect(position().x).toBeCloseTo(0)
  })

  it('settles the same way when the system takes the touch mid-drag', () => {
    const released = renderBubble()
    released.drag('onResponderRelease')
    const expected = released.position()
    released.unmount()

    const terminated = renderBubble()
    terminated.drag('onResponderTerminate')
    expect(terminated.position()).toEqual(expected)
  })

  it('lets only the collapsed bubble capture a drag', () => {
    const { liveTouches, toggle } = renderBubble()
    const capture = () =>
      liveTouches().onMoveShouldSetResponderCapture(touch(0, 50))
    expect(capture()).toBe(true)
    toggle()
    expect(capture()).toBe(false)
  })

  it('puts the touch handlers on the drawn bubble, not the larger wrapper', () => {
    // The wrapper's layout box is the full unscaled bubble, far bigger than a
    // collapsed one looks. Handlers there made that whole box draggable.
    const { wrap, touches } = renderBubble()
    expect(wrap.props.onResponderGrant).toBeUndefined()
    expect(wrap.props.pointerEvents).toBe('box-none')
    expect(touches.onResponderGrant).toBeDefined()
  })
})
