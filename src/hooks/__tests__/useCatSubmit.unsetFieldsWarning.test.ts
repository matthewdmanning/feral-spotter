import { renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useCatSubmit } from '../useCatSubmit'
import type { CatFormValues } from '../useCatForm'

/**
 * #205 changed what "unset" means for the missing-field warning: a category
 * left `undefined` (never tapped) triggers it, but a deliberately-chosen
 * "Unknown"/"Unsure" value must not — those are real answers (#152), now
 * distinguishable from untouched because the form no longer defaults to
 * them.
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

const untouchedForm: CatFormValues = {
  age: undefined,
  earTipped: undefined,
  owned: undefined,
  pattern: undefined,
  hairLength: undefined,
  color: undefined,
  sex: undefined,
  healthLabel: undefined,
}

const deliberatelyUnknownForm: CatFormValues = {
  age: 'adult',
  earTipped: 'unsure',
  owned: 'unsure',
  pattern: 'unknown',
  hairLength: 'short',
  color: 'black',
  sex: 'unknown',
  healthLabel: 'unknown',
}

describe('useCatSubmit — missing-field warning (#205)', () => {
  it('warns about every field left untouched (undefined)', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useCatSubmit({ form: untouchedForm, annotationEnabled: false }),
    )

    result.current.handleSave()

    expect(alertSpy).toHaveBeenCalledTimes(1)
    const [title, message] = alertSpy.mock.calls[0]
    expect(title).toBe('8 fields not set')
    expect(message).toContain('Age')
    expect(message).toContain('Health')

    alertSpy.mockRestore()
  })

  it('does not warn when Unknown/Unsure was deliberately chosen for every field', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useCatSubmit({
        form: deliberatelyUnknownForm,
        annotationEnabled: false,
      }),
    )

    result.current.handleSave()

    expect(alertSpy).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })
})
