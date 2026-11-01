import { renderHook } from '@testing-library/react-native'
import { useCatForm } from '../useCatForm'
import type { ObservedCat } from '../useSubmissionStore'

/**
 * Pins the acceptance criterion from #205 that the model-test on the
 * SegmentedControl atom alone can't reach: a fresh Cat Form must start with
 * no category selected. Reverting useCatForm's initial state to
 * CAT_DEFAULTS (the pre-#205 bug) would pass every other test in this repo
 * and only fail here.
 */
describe('useCatForm — initial selection (#205)', () => {
  it('starts every field unset on a fresh (no existingCat) form', () => {
    const { result } = renderHook(() => useCatForm())

    expect(result.current.age).toBeUndefined()
    expect(result.current.earTipped).toBeUndefined()
    expect(result.current.owned).toBeUndefined()
    expect(result.current.pattern).toBeUndefined()
    expect(result.current.hairLength).toBeUndefined()
    expect(result.current.color).toBeUndefined()
    expect(result.current.sex).toBeUndefined()
    expect(result.current.healthLabel).toBeUndefined()
  })

  it('hydrates from an existingCat instead of leaving fields unset', () => {
    const existingCat: ObservedCat = {
      local_id: 'cat-1',
      age: 'adult',
      ear_tipped: 'unsure',
      owned_domesticated: 'unsure',
      pattern: 'unknown',
      hair_length: 'short',
      color: 'black',
      sex: 'unknown',
      health_label: 'unknown',
      photo_local_ids: [],
      photos_reviewed: false,
    }

    const { result } = renderHook(() => useCatForm(existingCat))

    expect(result.current.age).toBe('adult')
    expect(result.current.earTipped).toBe('unsure')
    expect(result.current.owned).toBe('unsure')
    expect(result.current.pattern).toBe('unknown')
    expect(result.current.hairLength).toBe('short')
    expect(result.current.color).toBe('black')
    expect(result.current.sex).toBe('unknown')
    expect(result.current.healthLabel).toBe('unknown')
  })
})
