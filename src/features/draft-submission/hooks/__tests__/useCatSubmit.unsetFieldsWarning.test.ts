import * as ui from '@/src/shared/hooks/useUIStore'
import { router } from 'expo-router'
import { act, renderHook } from '@testing-library/react-native'
import { pressDialogButton } from '@/src/test-utils/dialog'

import { useCatSubmit } from '@/src/features/draft-submission/hooks/useCatSubmit'
import type { CatFormValues } from '@/src/features/draft-submission/hooks/useCatForm'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'

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
jest.mock('@/src/shared/analytics/analytics', () => ({
  ...jest.requireActual('@/src/shared/analytics/analytics'),
  captureEvent: jest.fn(),
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
  beforeEach(() => {
    jest.spyOn(ui, 'showAlert')
    ui.useUIStore.setState({ dialog: null })
    useSubmissionStore.getState().clearDraft()
    useBoundingBoxStore.getState().clearAll()
    useActiveCatFlowStore.getState().setActiveCatId('active-cat-id')
    useBoundingBoxStore.getState().addBox('active-cat-id', 'photo-1', {
      lowerLeftX: 1,
      lowerLeftY: 1,
      upperRightX: 9,
      upperRightY: 9,
    })
  })

  it('warns about every field left untouched (undefined)', async () => {
    const { result } = await renderHook(() =>
      useCatSubmit({ form: untouchedForm }),
    )
    await act(() => result.current.handleSave())

    expect(ui.showAlert).toHaveBeenCalledTimes(1)
    expect(ui.useUIStore.getState().dialog).toEqual(
      expect.objectContaining({
        title: '8 fields not set',
        message: [
          '• Age',
          '• Ear Tipped',
          '• Owned / Domesticated',
          '• Pattern',
          '• Hair Length',
          '• Color',
          '• Sex',
          '• Health',
        ].join('\n'),
      }),
    )
    expect(useSubmissionStore.getState().cats).toEqual([])

    await pressDialogButton('Cancel')
    expect(useSubmissionStore.getState().cats).toEqual([])
    expect(useActiveCatFlowStore.getState().activeCatId).toBe('active-cat-id')
    expect(router.replace).not.toHaveBeenCalled()

    await act(() => result.current.handleSave())
    await pressDialogButton('Save anyway')
    expect(useSubmissionStore.getState().cats).toEqual([
      {
        local_id: 'active-cat-id',
        age: 'unknown',
        ear_tipped: 'unsure',
        owned_domesticated: 'unsure',
        pattern: 'unknown',
        hair_length: 'unknown',
        color: 'unknown',
        sex: 'unknown',
        health_label: 'unknown',
        photo_local_ids: ['photo-1'],
        photos_reviewed: false,
      },
    ])
    expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
    expect(router.replace).toHaveBeenCalledWith('/submission/create')
  })

  it('does not warn when Unknown/Unsure was deliberately chosen for every field', async () => {
    const { result } = await renderHook(() =>
      useCatSubmit({ form: deliberatelyUnknownForm }),
    )
    await act(() => result.current.handleSave())

    expect(ui.showAlert).not.toHaveBeenCalled()
    expect(useSubmissionStore.getState().cats).toEqual([
      {
        local_id: 'active-cat-id',
        age: 'adult',
        ear_tipped: 'unsure',
        owned_domesticated: 'unsure',
        pattern: 'unknown',
        hair_length: 'short',
        color: 'black',
        sex: 'unknown',
        health_label: 'unknown',
        photo_local_ids: ['photo-1'],
        photos_reviewed: false,
      },
    ])
    expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
    expect(router.replace).toHaveBeenCalledWith('/submission/create')
  })
})
