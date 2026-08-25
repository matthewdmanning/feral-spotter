import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useActiveCatFlowStore } from '../useActiveCatFlowStore'
import { useBoundingBoxStore } from '../useBoundingBoxStore'
import { usePhotoStore } from '../usePhotoStore'
import { useRemoveCat } from '../useRemoveCat'
import { useSubmissionStore } from '../useSubmissionStore'

/**
 * Removing a saved cat (#299) has to clear everything derived from that cat
 * and nothing else. The failure modes worth covering are the asymmetric
 * ones: leaving boxes behind (they would reattach to a later cat, the #292
 * defect), clearing a *different* cat's activeCatId, and — the one users
 * would notice hardest — deleting photos another cat is still boxed on.
 *
 * Drives the real stores rather than mocks: "the boxes are gone" is the
 * claim, and a mocked store would only prove a call was made.
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

const CAT_ID = 'cat-1'
const OTHER_CAT_ID = 'cat-2'
const PHOTO_ID = 'photo-1'
const BOX = { lowerLeftX: 1, lowerLeftY: 1, upperRightX: 9, upperRightY: 9 }

const buildCat = (localId: string) => ({
  local_id: localId,
  age: 'adult' as const,
  ear_tipped: 'unsure' as const,
  owned_domesticated: 'unsure' as const,
  pattern: 'solid' as const,
  hair_length: 'short' as const,
  color: 'black' as const,
  sex: 'unknown' as const,
  health_label: 'unknown' as const,
  photo_local_ids: [PHOTO_ID],
  photos_reviewed: true,
})

const pressRemove = () => {
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2]
  act(() => {
    buttons?.find((b) => b.text === 'Remove')?.onPress?.()
  })
}

describe('useRemoveCat (#299)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
    useActiveCatFlowStore.getState().setActiveCatId(null)
    useSubmissionStore.setState({ cats: [] })
    usePhotoStore.setState({ photos: [], source: null, submissionId: null })

    useSubmissionStore.getState().addCat(buildCat(CAT_ID))
    useSubmissionStore.getState().addCat(buildCat(OTHER_CAT_ID))
    useBoundingBoxStore.getState().addBox(CAT_ID, PHOTO_ID, BOX)
    useBoundingBoxStore.getState().addBox(OTHER_CAT_ID, PHOTO_ID, BOX)
    usePhotoStore.getState().addPhoto({
      local_id: PHOTO_ID,
      uri: `file://${PHOTO_ID}.jpg`,
      uploaded: false,
      upload_progress: 0,
      width: 100,
      height: 100,
    })
  })

  it('confirms before removing anything', () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))

    expect(Alert.alert).toHaveBeenCalled()
    // Nothing gone until the destructive button is actually pressed.
    expect(useSubmissionStore.getState().cats).toHaveLength(2)
  })

  it('cancelling removes nothing', () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2]
    act(() => {
      buttons?.find((b) => b.text === 'Cancel')?.onPress?.()
    })

    expect(useSubmissionStore.getState().cats).toHaveLength(2)
    expect(
      useBoundingBoxStore.getState().getBoxesForPhoto(PHOTO_ID),
    ).toHaveLength(2)
  })

  it('removes the cat and its boxes, leaving the other cat intact', () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    pressRemove()

    const cats = useSubmissionStore.getState().cats
    expect(cats).toHaveLength(1)
    expect(cats[0].local_id).toBe(OTHER_CAT_ID)

    // The removed cat's box is gone; the other cat's box on the same photo
    // survives — a photo can show more than one cat (ADR-0004).
    expect(
      useBoundingBoxStore.getState().getBoxesForPhoto(PHOTO_ID),
    ).toHaveLength(1)
  })

  it('never deletes photos — the pool is submission-scoped, not cat-scoped', () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    pressRemove()

    expect(usePhotoStore.getState().photos).toHaveLength(1)
  })

  it('clears activeCatId when the removed cat was the in-progress one', () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    pressRemove()

    expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
  })

  it('leaves activeCatId alone when a different cat is in progress', () => {
    useActiveCatFlowStore.getState().setActiveCatId(OTHER_CAT_ID)
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    pressRemove()

    expect(useActiveCatFlowStore.getState().activeCatId).toBe(OTHER_CAT_ID)
  })

  it('runs the onRemoved callback so the caller can navigate away', () => {
    const onRemoved = jest.fn()
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID, onRemoved))
    pressRemove()

    expect(onRemoved).toHaveBeenCalled()
  })
})
