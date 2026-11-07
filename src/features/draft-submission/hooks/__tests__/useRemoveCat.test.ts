import { act, renderHook } from '@testing-library/react-native'
import * as ui from '@/src/shared/hooks/useUIStore'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useRemoveCat } from '@/src/features/draft-submission/hooks/useRemoveCat'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { pressDialogButton } from '@/src/test-utils/dialog'
import { observedCat } from '@/src/test-utils/catFixtures'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'

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

const CAT_ID = 'cat-1'
const OTHER_CAT_ID = 'cat-2'
const PHOTO_ID = 'photo-1'
const BOX = { lowerLeftX: 1, lowerLeftY: 1, upperRightX: 9, upperRightY: 9 }

const buildCat = (localId: string) =>
  observedCat({
    local_id: localId,
    photo_local_ids: [PHOTO_ID],
    photos_reviewed: true,
  })

describe('useRemoveCat (#299)', () => {
  beforeEach(() => {
    jest.spyOn(ui, 'showAlert')
    ui.useUIStore.setState({ dialog: null })
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
    useActiveCatFlowStore.getState().setActiveCatId(null)
    useSubmissionStore.setState({ cats: [] })
    usePhotoStore.setState({ photos: [], source: null, submissionId: null })

    useSubmissionStore.getState().addCat(buildCat(CAT_ID))
    useSubmissionStore.getState().addCat(buildCat(OTHER_CAT_ID))
    useBoundingBoxStore.getState().addBox(CAT_ID, PHOTO_ID, BOX)
    useBoundingBoxStore.getState().addBox(OTHER_CAT_ID, PHOTO_ID, BOX)
    usePhotoStore.getState().addPhoto(submissionPhoto({ local_id: PHOTO_ID }))
  })

  it('confirms before removing anything', async () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))

    expect(ui.showAlert).toHaveBeenCalled()
    // Nothing gone until the destructive button is actually pressed.
    expect(useSubmissionStore.getState().cats).toHaveLength(2)
  })

  it('cancelling removes nothing', async () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))

    await pressDialogButton('Cancel')

    expect(useSubmissionStore.getState().cats).toHaveLength(2)
    expect(
      useBoundingBoxStore.getState().getBoxesForPhoto(PHOTO_ID),
    ).toHaveLength(2)
  })

  it('removes the cat and its boxes, leaving the other cat intact', async () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    await pressDialogButton('Remove')

    const cats = useSubmissionStore.getState().cats
    expect(cats).toHaveLength(1)
    expect(cats[0].local_id).toBe(OTHER_CAT_ID)

    // The removed cat's box is gone; the other cat's box on the same photo
    // survives — a photo can show more than one cat (ADR-0004).
    expect(useBoundingBoxStore.getState().getBoxesForPhoto(PHOTO_ID)).toEqual([
      expect.objectContaining({ cat_id: OTHER_CAT_ID }),
    ])
    expect(useBoundingBoxStore.getState().getBoxesForCat(CAT_ID)).toEqual([])
  })

  it('never deletes photos — the pool is submission-scoped, not cat-scoped', async () => {
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    await pressDialogButton('Remove')

    expect(usePhotoStore.getState().photos).toHaveLength(1)
  })

  it('clears activeCatId when the removed cat was the in-progress one', async () => {
    useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    await pressDialogButton('Remove')

    expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
  })

  it('leaves activeCatId alone when a different cat is in progress', async () => {
    useActiveCatFlowStore.getState().setActiveCatId(OTHER_CAT_ID)
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID))
    await pressDialogButton('Remove')

    expect(useActiveCatFlowStore.getState().activeCatId).toBe(OTHER_CAT_ID)
  })

  it('runs the onRemoved callback so the caller can navigate away', async () => {
    const onRemoved = jest.fn()
    const { result } = renderHook(() => useRemoveCat())
    act(() => result.current(CAT_ID, onRemoved))
    await pressDialogButton('Remove')

    expect(onRemoved).toHaveBeenCalled()
  })
})
