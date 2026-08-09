import { act, fireEvent, render } from '@testing-library/react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { InsetCropBubble } from '../InsetCropBubble'

/**
 * Models the bubble's own collapse/expand flow (#202): defaults collapsed
 * on mount, and reports "collapsed" to the host only once the slide
 * animation actually finishes — not at the tap that starts it — so a host
 * layout (Cat Form's header zone) never shrinks its reservation while the
 * bubble could still be sliding over the title. "Expanded" is reported
 * immediately on tap instead, since over-reserving space early is safe.
 */
jest.mock('expo-image', () => ({
  Image: () => null,
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: () => anyProp() })
  const theme = new Proxy({}, { get: () => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

const BOX = {
  id: 'box-1',
  cat_id: 'cat-1',
  photo_local_id: 'photo-1',
  lowerLeftX: 0.1,
  lowerLeftY: 0.7,
  upperRightX: 0.3,
  upperRightY: 0.5,
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

const collapseFlowMachine = createMachine({
  id: 'insetCropBubbleCollapseFlow',
  initial: 'mountedCollapsed',
  states: {
    mountedCollapsed: {
      on: { PRESS: 'expanded' },
    },
    expanded: {
      on: { PRESS: 'collapsing' },
    },
    collapsing: {
      on: { COLLAPSE_ANIMATION_FINISHES: 'collapsedDocked' },
    },
    collapsedDocked: {
      on: { PRESS: 'expanded' },
    },
  },
})

describe('InsetCropBubble — collapse/expand flow (#202)', () => {
  let onCollapsedChange: jest.Mock
  let onSettledChange: jest.Mock
  let getByTestId: ReturnType<typeof render>['getByTestId']

  beforeEach(() => {
    jest.useFakeTimers()
    onCollapsedChange = jest.fn()
    onSettledChange = jest.fn()
    const result = render(
      <InsetCropBubble
        catId="cat-1"
        edge="top-right"
        onCollapsedChange={onCollapsedChange}
        onSettledChange={onSettledChange}
      />,
    )
    getByTestId = result.getByTestId
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const model = createTestModel(collapseFlowMachine)

  const press = () =>
    act(() => fireEvent.press(getByTestId('inset-crop-bubble')))

  const testParams = {
    states: {
      mountedCollapsed: () => {
        // Nothing was expanded first, so the initial state is reported
        // synchronously — no animation to wait for. Both signals agree at
        // rest.
        expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
        expect(onSettledChange).toHaveBeenLastCalledWith(true)
      },
      expanded: () => {
        // onCollapsedChange (header-zone) reports eagerly on expand.
        expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
        // onSettledChange (title fade) must NOT have moved yet — the
        // bubble hasn't actually slid into place over the title.
        expect(onSettledChange).toHaveBeenLastCalledWith(true)
      },
      collapsing: () => {
        // The tap has fired, but the 220ms slide hasn't finished — the host
        // must not have been told "collapsed" yet (it would prematurely
        // shrink the header zone while the bubble is still over the title).
        expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
        expect(onSettledChange).toHaveBeenLastCalledWith(true)
      },
      collapsedDocked: () => {
        expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
        expect(onSettledChange).toHaveBeenLastCalledWith(true)
      },
    },
    events: {
      PRESS: () => press(),
      COLLAPSE_ANIMATION_FINISHES: () => {
        act(() => {
          jest.advanceTimersByTime(220)
        })
      },
    },
  }

  const journeys = [
    {
      name: 'mounts collapsed, expands on tap, starts collapsing on second tap, docks once the slide finishes',
      events: [
        { type: 'PRESS' },
        { type: 'PRESS' },
        { type: 'COLLAPSE_ANIMATION_FINISHES' },
      ],
    },
    {
      name: 'tapping to re-expand from collapsed is reported immediately, no animation wait',
      events: [
        { type: 'PRESS' },
        { type: 'PRESS' },
        { type: 'COLLAPSE_ANIMATION_FINISHES' },
        { type: 'PRESS' },
      ],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
