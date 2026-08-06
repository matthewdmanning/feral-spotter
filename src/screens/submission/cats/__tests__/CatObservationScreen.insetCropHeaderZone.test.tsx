import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import CatObservationScreen from '../index'

/**
 * #174's Cat Form no-field-overlap guarantee, as a rendered-layout
 * assertion rather than a visual/pixel snapshot: the header-zone
 * container's `minHeight` must track the inset-crop bubble's own
 * computed diameter exactly, since that's what structurally confines the
 * bubble to the title row (it can never be pushed down over a field,
 * regardless of how large the diameter computes).
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

const MOCK_DIAMETER = 150
const MOCK_DEFAULT_DIAMETER = 68

// Mutable per-test so one test can simulate the bubble never having
// reported a diameter yet (the state before its onDiameterChange effect
// fires for the first time).
let mockShouldReportDiameter = true

jest.mock('@/src/components/organisms/InsetCropBubble', () => ({
  DEFAULT_DIAMETER: 68,
  InsetCropBubble: ({
    onDiameterChange,
  }: {
    onDiameterChange?: (d: number) => void
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => {
      if (mockShouldReportDiameter) onDiameterChange?.(MOCK_DIAMETER)
    }, [onDiameterChange])
    return null
  },
}))

describe('Cat Form header zone — no-field-overlap guarantee (#174)', () => {
  beforeEach(() => {
    mockShouldReportDiameter = true
  })

  it('reserves header-zone min-height equal to the bubble diameter once reported', () => {
    const { getByTestId } = render(<CatObservationScreen />)
    const headerZone = getByTestId('cat-form-header-zone')
    const flattened = StyleSheet.flatten(headerZone.props.style)
    expect(flattened.minHeight).toBe(MOCK_DIAMETER)
  })

  it('reserves at least the default diameter before the bubble has reported one', () => {
    mockShouldReportDiameter = false
    const { getByTestId } = render(<CatObservationScreen />)
    const headerZone = getByTestId('cat-form-header-zone')
    const flattened = StyleSheet.flatten(headerZone.props.style)
    // Must never be 0 or undefined — that would let the bubble's own
    // (nonzero, absolutely-positioned) default size overhang the header
    // and cover a field for a frame.
    expect(flattened.minHeight).toBe(MOCK_DEFAULT_DIAMETER)
  })
})
