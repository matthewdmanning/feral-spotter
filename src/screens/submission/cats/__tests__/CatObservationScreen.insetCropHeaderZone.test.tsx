import { act, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import CatObservationScreen from '../index'

/**
 * #174's Cat Form no-field-overlap guarantee, extended by #202: the
 * header-zone container's `minHeight` must track not just the bubble's
 * reported diameter, but also its collapsed/expanded state — collapsed
 * reserves only `COLLAPSED_DIAMETER`, not whatever the bubble last expanded
 * to, or the header holds dead space once the bubble docks at the edge.
 * Modeled as a flow (not hand-written per-case assertions) because it's a
 * real sequence of states a live bubble walks the screen through: default
 * collapsed on mount, reports a diameter once a box exists, collapses back
 * down, re-expands. Subsumes the two hand-written cases this replaced
 * (default-diameter-before-report, and reserves-the-reported-diameter).
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/src/hooks', () => ({
  useSubmissionStore: (sel: (s: { cats: unknown[] }) => unknown) =>
    sel({ cats: [] }),
}))

jest.mock('@/src/hooks/useActiveCatFlow', () => ({
  useActiveCatFlow: () => ({ activeCatId: 'cat-1' }),
  clearActiveCatIfMatches: jest.fn(),
}))

// #299's remove control reaches useBoundingBoxStore for clearForCat, which is
// persisted — so this layout-only suite now pulls the storage backends in.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

// This model covers header-zone layout only. The leave-confirm guard (#304)
// reaches the persisted stores and the navigation object, neither of which
// this test stands up — it has its own suite.
jest.mock('@/src/hooks/useAbandonCatGuard', () => ({
  useAbandonCatGuard: jest.fn(),
}))

jest.mock('@/src/hooks/useCatSubmit', () => ({
  useCatSubmit: () => ({
    handleSave: jest.fn(),
    saveLabel: 'Save Observation',
  }),
}))

jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (
    sel: (s: { settings: { annotation_enabled: boolean } }) => unknown,
  ) => sel({ settings: { annotation_enabled: true } }),
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

const REPORTED_DIAMETER = 150
const DEFAULT_DIAMETER = 68
const COLLAPSED_DIAMETER = 68

// The real InsetCropBubble owns its own default-collapsed / report-timing
// behavior (covered by InsetCropBubble.collapseFlow.model.test.tsx). This
// stub exposes its callback contract directly so the model here can drive
// the screen's own reservation logic through each state a live bubble
// would put it in, without re-testing the bubble's internals.
let latestOnDiameterChange: ((d: number) => void) | undefined
let latestOnCollapsedChange: ((c: boolean) => void) | undefined

jest.mock('@/src/components/organisms/InsetCropBubble', () => ({
  DEFAULT_DIAMETER: 68,
  COLLAPSED_DIAMETER: 68,
  InsetCropBubble: ({
    onDiameterChange,
    onCollapsedChange,
  }: {
    onDiameterChange?: (d: number) => void
    onCollapsedChange?: (c: boolean) => void
  }) => {
    latestOnDiameterChange = onDiameterChange
    latestOnCollapsedChange = onCollapsedChange
    return null
  },
}))

const headerZoneMachine = createMachine({
  id: 'catFormHeaderZone',
  initial: 'mountedCollapsedNoDiameterYet',
  states: {
    mountedCollapsedNoDiameterYet: {
      on: { EXPAND: 'expandedNoDiameterYet' },
    },
    expandedNoDiameterYet: {
      on: { REPORT_DIAMETER: 'expandedWithDiameter' },
    },
    expandedWithDiameter: {
      on: { COLLAPSE: 'collapsedAfterDiameterKnown' },
    },
    collapsedAfterDiameterKnown: {
      on: { EXPAND: 'reExpandedRetainsDiameter' },
    },
    reExpandedRetainsDiameter: {},
  },
})

describe('Cat Form header zone — no-field-overlap guarantee (#174, #202)', () => {
  let getByTestId: ReturnType<typeof render>['getByTestId']

  beforeEach(() => {
    latestOnDiameterChange = undefined
    latestOnCollapsedChange = undefined
    const result = render(<CatObservationScreen />)
    getByTestId = result.getByTestId
  })

  const minHeight = () => {
    const headerZone = getByTestId('cat-form-header-zone')
    const flattened = StyleSheet.flatten(headerZone.props.style) as {
      minHeight?: number
    }
    return flattened.minHeight
  }

  const model = createTestModel(headerZoneMachine)

  const testParams = {
    states: {
      mountedCollapsedNoDiameterYet: () => {
        // Must never be 0/undefined — that would let the bubble's own
        // (nonzero, absolutely-positioned) size overhang the header for a
        // frame before either callback has fired. Note: DEFAULT_DIAMETER
        // and COLLAPSED_DIAMETER are both 68 by design, so this assertion
        // can't tell which one actually produced the value — the
        // `expandedNoDiameterYet` state below (reached via journey 2's
        // leading EXPAND event) is what actually pins bubbleDiameter's own
        // default, independent of collapse state.
        expect(minHeight()).toBe(DEFAULT_DIAMETER)
      },
      expandedNoDiameterYet: () => {
        expect(minHeight()).toBe(DEFAULT_DIAMETER)
      },
      expandedWithDiameter: () => {
        expect(minHeight()).toBe(REPORTED_DIAMETER)
      },
      collapsedAfterDiameterKnown: () => {
        // The reservation shrinks to the collapsed size, not the diameter
        // it was last expanded to (#202) — a stale full-size reservation
        // would leave dead space in the header once the bubble docks.
        expect(minHeight()).toBe(COLLAPSED_DIAMETER)
      },
      reExpandedRetainsDiameter: () => {
        // Re-expanding restores the previously-reported diameter, not the
        // pre-report default — the bubble doesn't forget its size.
        expect(minHeight()).toBe(REPORTED_DIAMETER)
      },
    },
    events: {
      EXPAND: () => {
        act(() => latestOnCollapsedChange?.(false))
      },
      REPORT_DIAMETER: () => {
        act(() => latestOnDiameterChange?.(REPORTED_DIAMETER))
      },
      COLLAPSE: () => {
        act(() => latestOnCollapsedChange?.(true))
      },
    },
  }

  const journeys = [
    {
      name: 'reserves the default before any diameter is known',
      events: [],
    },
    {
      name: 'reserves the reported diameter once expanded and known',
      events: [{ type: 'EXPAND' }, { type: 'REPORT_DIAMETER' }],
    },
    {
      name: 'shrinks to the collapsed size once docked, then restores on re-expand',
      events: [
        { type: 'EXPAND' },
        { type: 'REPORT_DIAMETER' },
        { type: 'COLLAPSE' },
        { type: 'EXPAND' },
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
