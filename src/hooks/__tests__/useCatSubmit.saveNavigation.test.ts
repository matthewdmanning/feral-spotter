import { renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import { useCatSubmit } from '../useCatSubmit'
import type { CatFormValues } from '../useCatForm'

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
jest.mock('@/src/hooks', () => ({
  useSubmissionStore: (
    sel: (s: { addCat: jest.Mock; updateCat: jest.Mock }) => unknown,
  ) => sel({ addCat: jest.fn(), updateCat: jest.fn() }),
}))
jest.mock('@/src/hooks/useActiveCatFlow', () => ({
  useActiveCatFlow: () => ({
    activeCatId: 'active-cat-id',
    clearActiveCat: jest.fn(),
  }),
}))
jest.mock('@/src/hooks/useBoundingBoxStore', () => ({
  useBoundingBoxStore: (
    sel: (s: { getBoxedPhotoIds: () => string[] }) => unknown,
  ) => sel({ getBoxedPhotoIds: () => [] }),
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
  it('replaces to Cat List, never a default pop to Camera', () => {
    const { result } = renderHook(() =>
      useCatSubmit({ form: filledForm, annotationEnabled: false }),
    )

    result.current.handleSave()

    expect(router.replace).toHaveBeenCalledWith('/submission/create')
    expect(router.back).not.toHaveBeenCalled()
  })
})
