import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { act, userEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
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
  lowerLeftX: 0.4,
  lowerLeftY: 0.55,
  upperRightX: 0.6,
  upperRightY: 0.45,
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

async function renderBubble(onHoldChange?: (held: boolean) => void) {
  jest.useFakeTimers()
  const utils = await render(
    <InsetCropBubble
      catId="cat-1"
      edge="top-center"

      onHoldChange={onHoldChange}
    />,
  )
  // The wrapper carries the drag transform; the inner view takes the touches.
  const inner = utils.getByTestId('inset-crop-bubble').parent!
  const wrap = inner.parent!
  const toggle = async () => {
    await userEvent.press(utils.getByTestId('inset-crop-bubble'))
    await act(() => jest.advanceTimersByTime(300))
  }
  const position = () => {
    const [{ translateX }, { translateY }] = StyleSheet.flatten(
      wrap.props.style,
    ).transform as { translateX?: unknown; translateY?: unknown }[]
    return { x: resolved(translateX), y: resolved(translateY) }
  }
  const touches = inner.props as Handlers
  const drag = async (end: 'onResponderRelease' | 'onResponderTerminate') => {
    await act(() => {
      touches.onResponderGrant(touch(0, 0))
      touches.onResponderMove(touch(-90, 200))
      touches[end](touch(-90, 200))
      jest.advanceTimersByTime(300)
    })
  }
  // Handlers are rebuilt when the bubble expands, so read them live.
  const liveTouches = () =>
    utils.getByTestId('inset-crop-bubble').parent!.props as Handlers
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
  it('holds from grant to release and keeps the dropped height at the dock column', async () => {
    const onHoldChange = jest.fn()
    const { touches, position } = await renderBubble(onHoldChange)

    expect(onHoldChange).not.toHaveBeenCalled()
    await act(() => {
      touches.onResponderGrant(touch(0, 0))
      touches.onResponderMove(touch(-90, 200))
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(true)

    await act(() => {
      touches.onResponderRelease(touch(-90, 200))
      jest.advanceTimersByTime(300)
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(false)
    expect(position().y).toBeCloseTo(200)
    // Slid back to the right edge; only the height changed.
    expect(position().x).toBeCloseTo(0)
  })

  it('moves only up and down mid-drag and keeps a drop on screen', async () => {
    const dropAt = async (x: number, y: number) => {
      const bubble = await renderBubble()
      await act(() => {
        bubble.touches.onResponderGrant(touch(0, 0))
        bubble.touches.onResponderMove(touch(x, y))
      })
      const midDrag = bubble.position()
      await act(() => {
        bubble.touches.onResponderRelease(touch(x, y))
        jest.advanceTimersByTime(300)
      })
      const dropped = bubble.position()
      await bubble.unmount()
      return { midDrag, dropped }
    }

    // Finger went 90dp left; the bubble stays in its column.
    expect((await dropAt(-90, 200)).midDrag.x).toBeCloseTo(0)
    // Above the dock settles at the dock.
    expect((await dropAt(0, -500)).dropped.y).toBeCloseTo(0)
    // Far past the bottom settles back on screen.
    const low = (await dropAt(0, 100_000)).dropped.y
    expect(low).toBeGreaterThan(0)
    expect(low).toBeLessThan(100_000)
  })

  it('keeps a dragged bubble’s height through expand and collapse', async () => {
    const { touches, toggle, position } = await renderBubble()
    await act(() => {
      touches.onResponderGrant(touch(0, 0))
      touches.onResponderMove(touch(0, 200))
      touches.onResponderRelease(touch(0, 200))
      jest.advanceTimersByTime(300)
    })
    await toggle()
    await toggle()
    expect(position().y).toBeCloseTo(200)
    expect(position().x).toBeCloseTo(0)
  })

  it('settles the same way when the system takes the touch mid-drag', async () => {
    const released = await renderBubble()
    await released.drag('onResponderRelease')
    const expected = released.position()
    await released.unmount()

    const onHoldChange = jest.fn()
    const terminated = await renderBubble(onHoldChange)
    await terminated.drag('onResponderTerminate')
    expect(terminated.position()).toEqual(expected)
    expect(onHoldChange.mock.calls).toEqual([[true], [false]])
  })

  it('lets only the collapsed bubble capture a drag', async () => {
    const { liveTouches, toggle } = await renderBubble()
    const capture = () =>
      liveTouches().onMoveShouldSetResponderCapture(touch(0, 50))
    expect(capture()).toBe(true)
    await toggle()
    expect(capture()).toBe(false)
  })

  it('puts the touch handlers on the drawn bubble, not the larger wrapper', async () => {
    // The wrapper's layout box is the full unscaled bubble, far bigger than a
    // collapsed one looks. Handlers there made that whole box draggable.
    const onHoldChange = jest.fn()
    const { wrap, touches } = await renderBubble(onHoldChange)
    expect(wrap.props.onResponderGrant).toBeUndefined()
    expect(wrap.props.pointerEvents).toBe('box-none')
    // The drawn bubble's handler is the real drag: a grant starts a hold.
    await act(() => {
      touches.onResponderGrant(touch(0, 0))
    })
    expect(onHoldChange).toHaveBeenLastCalledWith(true)
  })
})
