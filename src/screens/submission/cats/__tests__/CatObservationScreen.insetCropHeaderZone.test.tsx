import { act, render } from '@testing-library/react-native'
import { ScrollView } from 'react-native'
import CatObservationScreen from '../index'

/**
 * The Cat Form page must not scroll under a bubble being dragged. The header
 * zone's size is fixed, so no bubble state moves the form.
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
  }),
}))

jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (
    sel: (s: { settings: { annotation_enabled: boolean } }) => unknown,
  ) => sel({ settings: { annotation_enabled: true } }),
}))

// The real InsetCropBubble owns its own drag behavior (see
// InsetCropBubble.drag.test.tsx). This stub exposes only the hold callback
// the screen consumes.
let latestOnHoldChange: ((held: boolean) => void) | undefined

jest.mock('@/src/components/organisms/InsetCropBubble', () => ({
  DEFAULT_DIAMETER: 68,
  COLLAPSED_DIAMETER: 68,
  InsetCropBubble: ({
    onHoldChange,
  }: {
    onHoldChange?: (held: boolean) => void
  }) => {
    latestOnHoldChange = onHoldChange
    return null
  },
}))

describe('Cat Form page scroll while the bubble is held', () => {
  // A drag on the bubble must not also scroll the page under it.
  it('stops the page scrolling while a touch is on the bubble, and restores it after', () => {
    const { UNSAFE_getByType } = render(<CatObservationScreen />)
    const scrollEnabled = () => UNSAFE_getByType(ScrollView).props.scrollEnabled

    expect(scrollEnabled()).toBe(true)

    act(() => latestOnHoldChange?.(true))
    expect(scrollEnabled()).toBe(false)

    act(() => latestOnHoldChange?.(false))
    expect(scrollEnabled()).toBe(true)
  })
})
