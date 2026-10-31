import * as ui from '@/src/hooks/useUIStore'
import { act, renderHook } from '@testing-library/react-native'

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

// A faithful stand-in for Expo Router's usePreventRemove: the latest render's
// flag arms the guard, and disablePrevention drops it at once (as the real
// hook does), not on the next render.
let prevented = false
let preventCallback:
  | ((options: { data: { action: unknown }; repeat: () => void }) => void)
  | undefined
const mockRepeat = jest.fn()
const mockDisablePrevention = jest.fn(() => {
  prevented = false
})

jest.mock('expo-router', () => ({
  usePreventRemove: (
    preventRemove: boolean,
    callback: typeof preventCallback,
  ) => {
    prevented = preventRemove
    preventCallback = callback
    return mockDisablePrevention
  },
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}))

const CAT_ID = 'cat-1'
const OTHER_CAT_ID = 'cat-2'
const PHOTO_ID = 'photo-1'
const BOX = { lowerLeftX: 1, lowerLeftY: 1, upperRightX: 9, upperRightY: 9 }

/**
 * Simulates any exit — header back, swipe-back or hardware back all land
 * here. Returns whether the router blocked it.
 */
const attemptLeave = () => {
  const blocked = prevented
  act(() => {
    if (prevented) {
      preventCallback?.({
        data: { action: { type: 'GO_BACK' } },
        repeat: mockRepeat,
      })
    }
  })
  return { blocked }
}

const pressRemove = () => {
  const buttons = jest.mocked(ui.showAlert).mock.calls[0][2]
  act(() => {
    buttons?.find((b) => b.text === 'Remove progress on this cat')?.onPress?.()
  })
}

describe('useAbandonCatGuard (#304)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prevented = false
    preventCallback = undefined
    jest.spyOn(ui, 'showAlert')
    ui.useUIStore.setState({ dialog: null })
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
    useActiveCatFlowStore.getState().setActiveCatId(null)
  })

  it('prompts and blocks the exit when an unsaved cat is in progress', () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))

    const { blocked } = attemptLeave()

    expect(blocked).toBe(true)
    expect(ui.showAlert).toHaveBeenCalledTimes(1)
  })

  it('lets the exit through after a save has cleared the active cat', () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))
    act(() => {
      useActiveCatFlowStore.getState().setActiveCatId(null)
    })

    const { blocked } = attemptLeave()

    expect(blocked).toBe(false)
    expect(ui.showAlert).not.toHaveBeenCalled()
  })

  it('lets a save through that navigates before the guard re-renders', () => {
    // handleSave clears the id and navigates in the same tick, so the guard
    // is still armed when the router asks. It must read the id fresh and
    // repeat the navigation — a stale read would popup on every save.
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))
    useActiveCatFlowStore.setState({ activeCatId: null })

    const { blocked } = attemptLeave()

    expect(blocked).toBe(true)
    expect(ui.showAlert).not.toHaveBeenCalled()
    expect(mockDisablePrevention).toHaveBeenCalled()
    expect(mockRepeat).toHaveBeenCalledTimes(1)
  })

  it('lets the exit through when editing an already-saved cat', () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(true))

    const { blocked } = attemptLeave()

    expect(blocked).toBe(false)
    expect(ui.showAlert).not.toHaveBeenCalled()
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

  it('Cancel leaves the boxes and the active cat alone', async () => {
    useBoundingBoxStore.getState().addBox(CAT_ID, PHOTO_ID, BOX)
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    renderHook(() => useAbandonCatGuard(false))

    attemptLeave()
    const cancel = ui.useUIStore
      .getState()
      .dialog?.buttons.find((button) => button.text === 'Cancel')
    expect(cancel).toEqual(expect.objectContaining({ style: 'cancel' }))
    await act(async () => {
      ui.useUIStore.getState().dismissDialog()
      await cancel?.onPress?.()
    })

    expect(useBoundingBoxStore.getState().getBoxesForCat(CAT_ID)).toHaveLength(
      1,
    )
    expect(useActiveCatFlowStore.getState().activeCatId).toBe(CAT_ID)
  })
})
