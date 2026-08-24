import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useAbandonCatGuard } from '../useAbandonCatGuard'
import { useActiveCatFlowStore } from '../useActiveCatFlowStore'
import { useBoundingBoxStore } from '../useBoundingBoxStore'

/**
 * The guard's value is entirely in *when it fires* (#304). Firing on a save
 * would block every successful Cat Form submit behind a popup; firing on an
 * edit would offer to delete a saved cat's boxes; not firing on an abandoned
 * pass is the bug itself. Those three cases are what this covers — plus that
 * removal actually clears the durable state, since a confirm that removes
 * nothing is worse than no confirm at all.
 *
 * Drives the real useBoundingBoxStore rather than a mock: "the boxes are
 * gone" is the claim, and a mocked store would only prove the call was made.
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

let beforeRemoveListener: ((e: { preventDefault: () => void }) => void) | null =
  null
const mockAddListener = jest.fn(
  (event: string, cb: typeof beforeRemoveListener) => {
    if (event === 'beforeRemove') beforeRemoveListener = cb
    return jest.fn()
  },
)

jest.mock('expo-router', () => ({
  useNavigation: () => ({ addListener: mockAddListener }),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}))

const CAT_ID = 'cat-1'
const OTHER_CAT_ID = 'cat-2'
const PHOTO_ID = 'photo-1'
const BOX = { lowerLeftX: 1, lowerLeftY: 1, upperRightX: 9, upperRightY: 9 }

/** Simulates any exit — header back, swipe-back or hardware back all land here. */
const attemptLeave = () => {
  const preventDefault = jest.fn()
  act(() => {
    beforeRemoveListener?.({ preventDefault })
  })
  return { preventDefault }
}

const pressRemove = () => {
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2]
  act(() => {
    buttons?.find((b) => b.text === 'Remove progress on this cat')?.onPress?.()
  })
}

describe('useAbandonCatGuard (#304)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    beforeRemoveListener = null
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
    useActiveCatFlowStore.getState().setActiveCatId(null)
  })

  it('prompts and blocks the exit when an unsaved cat is in progress', () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))

    const { preventDefault } = attemptLeave()

    expect(preventDefault).toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledTimes(1)
  })

  it('lets the exit through after a save has cleared the active cat', () => {
    // handleSave calls clearActiveCat() immediately before navigating, so the
    // listener must read the id fresh — a stale closure would popup on save.
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))
    act(() => {
      useActiveCatFlowStore.getState().setActiveCatId(null)
    })

    const { preventDefault } = attemptLeave()

    expect(preventDefault).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('lets the exit through when editing an already-saved cat', () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(true))

    const { preventDefault } = attemptLeave()

    expect(preventDefault).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('removing clears the abandoned cat’s boxes, absences and id — and nothing else', () => {
    const store = useBoundingBoxStore.getState()
    store.addBox(CAT_ID, PHOTO_ID, BOX)
    store.addBox(CAT_ID, PHOTO_ID, BOX) // second box populates lastBoxes
    store.markAbsent(CAT_ID, 'photo-2')
    store.addBox(OTHER_CAT_ID, PHOTO_ID, BOX)
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))

    attemptLeave()
    pressRemove()

    const after = useBoundingBoxStore.getState()
    const keysFor = (id: string) =>
      [
        ...Object.keys(after.boxes),
        ...Object.keys(after.absences),
        ...Object.keys(after.lastBoxes),
      ].filter((k) => k.startsWith(`${id}:`))

    expect(keysFor(CAT_ID)).toEqual([])
    expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
    // The other cat is untouched — this removes one cat, not the draft.
    expect(after.getBoxesForCat(OTHER_CAT_ID)).toHaveLength(1)
  })

  it('Cancel leaves the boxes and the active cat alone', () => {
    useBoundingBoxStore.getState().addBox(CAT_ID, PHOTO_ID, BOX)
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))

    attemptLeave()
    // Cancel has no onPress — dismissing the Alert is the whole action.

    expect(useBoundingBoxStore.getState().getBoxesForCat(CAT_ID)).toHaveLength(
      1,
    )
    expect(useActiveCatFlowStore.getState().activeCatId).toBe(CAT_ID)
  })
})
