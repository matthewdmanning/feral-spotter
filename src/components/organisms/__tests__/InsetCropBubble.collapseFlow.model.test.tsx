import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { act, userEvent, render } from '@testing-library/react-native'
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

const BOX = {
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
  useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', BOX)
})

const collapseFlowMachine = createMachine({
  id: 'insetCropBubbleCollapseFlow',
  initial: 'mountedCollapsed',
  states: {
    mountedCollapsed: { on: { PRESS: 'expanding' } },
    expanding: { on: { ALMOST_FINISHED: 'expandingBeforeFinish' } },
    expandingBeforeFinish: { on: { FINISH: 'expanded' } },
    expanded: { on: { PRESS: 'collapsing' } },
    collapsing: { on: { ALMOST_FINISHED: 'collapsingBeforeFinish' } },
    collapsingBeforeFinish: { on: { FINISH: 'collapsedDocked' } },
    collapsedDocked: { on: { PRESS: 'expanding' } },
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

  const press = () => userEvent.press(getByTestId('inset-crop-bubble'))

  const expectSignals = (collapsed: boolean, settled: boolean) => {
    expect(onCollapsedChange).toHaveBeenLastCalledWith(collapsed)
    expect(onSettledChange).toHaveBeenLastCalledWith(settled)
    expect(getByTestId('inset-crop-bubble').props.accessibilityLabel).toBe(
      collapsed && settled
        ? 'Expand cat photo preview'
        : 'Collapse cat photo preview',
    )
  }

  const expectCollapsing = () => {
    // The button immediately offers expansion again, but the host must keep
    // its expanded reservation and title fade until the slide finishes.
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
    expect(onSettledChange).toHaveBeenLastCalledWith(false)
    expect(getByTestId('inset-crop-bubble').props.accessibilityLabel).toBe(
      'Expand cat photo preview',
    )
  }

  const testParams = {
    states: {
      mountedCollapsed: () => expectSignals(true, true),
      expanding: () => expectSignals(false, true),
      expandingBeforeFinish: () => expectSignals(false, true),
      expanded: () => expectSignals(false, false),
      collapsing: expectCollapsing,
      collapsingBeforeFinish: expectCollapsing,
      collapsedDocked: () => expectSignals(true, true),
    },
    events: {
      PRESS: () => press(),
      ALMOST_FINISHED: () => {
        act(() => jest.advanceTimersByTime(219))
      },
      FINISH: () => {
        act(() => jest.advanceTimersByTime(1))
      },
    },
  }

  const journeys = [
    {
      name: 'mounts collapsed, settles expansion, then docks only once the collapse slide finishes',
      events: [
        { type: 'PRESS' },
        { type: 'ALMOST_FINISHED' },
        { type: 'FINISH' },
        { type: 'PRESS' },
        { type: 'ALMOST_FINISHED' },
        { type: 'FINISH' },
      ],
    },
    {
      name: 're-expansion reports eagerly to the layout and waits for the slide before fading the title',
      events: [
        { type: 'PRESS' },
        { type: 'ALMOST_FINISHED' },
        { type: 'FINISH' },
        { type: 'PRESS' },
        { type: 'ALMOST_FINISHED' },
        { type: 'FINISH' },
        { type: 'PRESS' },
        { type: 'ALMOST_FINISHED' },
        { type: 'FINISH' },
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
