import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useAnnotatePass } from '../useAnnotatePass'

/**
 * handleLongPressRemove's confirmation branching (src/hooks/useAnnotatePass.ts)
 * is a pure decision on one input (the skip-confirm setting), not a
 * stateful flow — plain cases here, not an xstate model, matching this
 * repo's convention for non-stateful branching (see libraryPickTime.test.ts).
 * Carousel-position logic is modeled separately in
 * useAnnotatePass.carouselNav.model.test.ts.
 */
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

jest.mock('../useActiveCatFlow', () => ({
  useActiveCatFlow: () => ({
    activeCatId: 'active-cat',
    getPhotoStatus: () => 'pending',
    handleBoxConfirmed: jest.fn(),
    handleNotInPhoto: jest.fn(),
    handleBoxingComplete: jest.fn(),
    clearActiveCat: jest.fn(),
    handleAbandonPass: jest.fn(),
  }),
}))

const PHOTO = {
  local_id: 'photo-1',
  uri: 'a',
  uploaded: false,
  upload_progress: 0,
  width: 1,
  height: 1,
}

const mockRemovePhoto = jest.fn()
const mockRemoveBoxesForPhoto = jest.fn()
const mockUpdateSetting = jest.fn()

let mockSkipConfirm: boolean

jest.mock('@/src/hooks', () => ({
  usePhotoStore: (sel: (s: object) => unknown) =>
    sel({ photos: [PHOTO], removePhoto: mockRemovePhoto }),
}))
jest.mock('@/src/hooks/useBoundingBoxStore', () => ({
  useBoundingBoxStore: (sel: (s: object) => unknown) =>
    sel({ removeBoxesForPhoto: mockRemoveBoxesForPhoto }),
}))
jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (sel: (s: object) => unknown) =>
    sel({
      get settings() {
        return { skip_photo_remove_confirm: mockSkipConfirm }
      },
      updateSetting: mockUpdateSetting,
    }),
}))

describe('useAnnotatePass — handleLongPressRemove confirmation branching', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSkipConfirm = false
  })

  it('skip-confirm on: removes immediately without an Alert', () => {
    mockSkipConfirm = true
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { result } = renderHook(() => useAnnotatePass())

    act(() => result.current.handleLongPressRemove())

    expect(alertSpy).not.toHaveBeenCalled()
    expect(mockRemovePhoto).toHaveBeenCalledWith('photo-1')
    expect(mockRemoveBoxesForPhoto).toHaveBeenCalledWith('photo-1')
  })

  it('skip-confirm off: Alert offers a 3rd "don\'t ask again" option', () => {
    mockSkipConfirm = false
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { result } = renderHook(() => useAnnotatePass())

    act(() => result.current.handleLongPressRemove())

    expect(alertSpy).toHaveBeenCalledTimes(1)
    const [title, message, buttons] = alertSpy.mock.calls[0]
    expect(title).toBe('Remove photo from submission?')
    expect(message).toBe('This cannot be undone.')
    expect(buttons?.map((b) => b.text)).toEqual([
      'Cancel',
      "Remove, don't ask again",
      'Remove',
    ])
  })

  it('pressing "Remove, don\'t ask again" persists the setting and removes', () => {
    mockSkipConfirm = false
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === "Remove, don't ask again")?.onPress?.()
    })
    const { result } = renderHook(() => useAnnotatePass())

    act(() => result.current.handleLongPressRemove())

    expect(mockUpdateSetting).toHaveBeenCalledWith(
      'skip_photo_remove_confirm',
      true,
    )
    expect(mockRemovePhoto).toHaveBeenCalledWith('photo-1')
  })

  it('pressing Cancel removes nothing', () => {
    mockSkipConfirm = false
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Cancel')?.onPress?.()
    })
    const { result } = renderHook(() => useAnnotatePass())

    act(() => result.current.handleLongPressRemove())

    expect(mockRemovePhoto).not.toHaveBeenCalled()
  })
})
