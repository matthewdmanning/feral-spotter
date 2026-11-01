import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import { useCatSubmit } from '@/src/features/draft-submission/hooks/useCatSubmit'
import type { CatFormValues } from '@/src/features/draft-submission/hooks/useCatForm'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'

/**
 * #203: Cat Form Submit must land on Cat List (`/submission/create`), never
 * Camera. The bug was router.back()'s default pop — for the very first cat
 * of a submission, Cat Form was reached via a chain of `replace`s (Cat
 * List's zero-cats auto-skip -> Annotate -> Cat Form), which strips Cat
 * List off the stack entirely, so back() landed on Camera instead.
 */

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-cat-id' }))
jest.mock('@/src/shared/analytics/analytics', () => ({
  captureEvent: jest.fn(),
  EVENTS: { CAT_OBSERVATION_SAVED: 'cat_observation_saved' },
}))

const filledForm: CatFormValues = {
  age: 'adult',
  earTipped: 'yes',
  owned: 'no',
  pattern: 'solid',
  hairLength: 'short',
  color: 'black',
  sex: 'male',
  healthLabel: 'good',
}

describe('useCatSubmit — save navigation (#203)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSubmissionStore.getState().clearDraft()
    useBoundingBoxStore.getState().clearAll()
    useActiveCatFlowStore.getState().setActiveCatId('active-cat-id')
    const box = { lowerLeftX: 1, lowerLeftY: 1, upperRightX: 9, upperRightY: 9 }
    useBoundingBoxStore.getState().addBox('active-cat-id', 'photo-1', box)
    useBoundingBoxStore.getState().addBox('other-cat', 'photo-2', box)
  })

  it('replaces to Cat List, never a default pop to Camera', () => {
    const { result } = renderHook(() => useCatSubmit({ form: filledForm }))

    act(() => result.current.handleSave())

    expect(useSubmissionStore.getState().cats).toEqual([
      {
        local_id: 'active-cat-id',
        age: 'adult',
        ear_tipped: 'yes',
        owned_domesticated: 'no',
        pattern: 'solid',
        hair_length: 'short',
        color: 'black',
        sex: 'male',
        health_label: 'good',
        photo_local_ids: ['photo-1'],
        photos_reviewed: false,
      },
    ])
    expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
    expect(router.replace).toHaveBeenCalledWith('/submission/create')
    expect(router.back).not.toHaveBeenCalled()
  })
})
