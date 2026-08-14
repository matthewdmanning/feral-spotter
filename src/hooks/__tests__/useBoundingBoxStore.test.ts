import { useBoundingBoxStore } from '../useBoundingBoxStore'

/**
 * Purpose: removeBoxesForPhoto (#177) is the fix for a photo removed
 * mid-annotate-pass leaving its boxes/absences/lastBoxes behind. A photo
 * can carry boxes for more than one cat (spec story 4), so the sweep must
 * clear every cat's entry for that photo, not just one, and must leave
 * unrelated keys (same cat, other photos) untouched.
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

const box = () => ({
  lowerLeftX: 0.1,
  lowerLeftY: 0.6,
  upperRightX: 0.5,
  upperRightY: 0.2,
})

describe('useBoundingBoxStore — removeBoxesForPhoto', () => {
  beforeEach(() => {
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
  })

  it('clears every cat’s box on the removed photo', () => {
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', box())
    useBoundingBoxStore.getState().addBox('cat-2', 'photo-1', box())

    useBoundingBoxStore.getState().removeBoxesForPhoto('photo-1')

    expect(
      useBoundingBoxStore.getState().boxes['cat-1:photo-1'],
    ).toBeUndefined()
    expect(
      useBoundingBoxStore.getState().boxes['cat-2:photo-1'],
    ).toBeUndefined()
  })

  it('clears absences on the removed photo across cats', () => {
    useBoundingBoxStore.getState().markAbsent('cat-1', 'photo-1')
    useBoundingBoxStore.getState().markAbsent('cat-2', 'photo-1')

    useBoundingBoxStore.getState().removeBoxesForPhoto('photo-1')

    expect(
      useBoundingBoxStore.getState().absences['cat-1:photo-1'],
    ).toBeUndefined()
    expect(
      useBoundingBoxStore.getState().absences['cat-2:photo-1'],
    ).toBeUndefined()
  })

  it('clears lastBoxes on the removed photo', () => {
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', box())
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', box()) // second call populates lastBoxes

    useBoundingBoxStore.getState().removeBoxesForPhoto('photo-1')

    expect(
      useBoundingBoxStore.getState().lastBoxes['cat-1:photo-1'],
    ).toBeUndefined()
  })

  it('leaves the same cat’s other photos untouched', () => {
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', box())
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-2', box())

    useBoundingBoxStore.getState().removeBoxesForPhoto('photo-1')

    expect(useBoundingBoxStore.getState().boxes['cat-1:photo-2']).toHaveLength(
      1,
    )
  })
})

/**
 * Purpose: #264's submit payload needs every box for a cat, across all its
 * photos, without leaking another cat's boxes — the key scheme is a plain
 * string prefix match, which is the exact class of bug that would let
 * 'cat-1' accidentally match a 'cat-10:...' key without the colon separator.
 */
describe('useBoundingBoxStore — getBoxesForCat', () => {
  beforeEach(() => {
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
  })

  it("returns every box across a cat's photos, excluding other cats", () => {
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-1', box())
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-2', box())
    useBoundingBoxStore.getState().addBox('cat-10', 'photo-1', box())

    const result = useBoundingBoxStore.getState().getBoxesForCat('cat-1')

    expect(result).toHaveLength(2)
    expect(result.every((b) => b.cat_id === 'cat-1')).toBe(true)
  })
})
