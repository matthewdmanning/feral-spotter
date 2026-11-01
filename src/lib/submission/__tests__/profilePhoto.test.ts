import { observedCat } from '@/src/test-utils/catFixtures'
import type { BoundingBox } from '@/src/types/BoundingBox'
import { resolveProfileBox, toCachedCat } from '../profilePhoto'

const box = (photo_local_id: string, x = 0.1): BoundingBox => ({
  id: `box-${photo_local_id}`,
  cat_id: 'cat-1',
  photo_local_id,
  lowerLeftX: x,
  lowerLeftY: 0.6,
  upperRightX: 0.9,
  upperRightY: 0.3,
})

describe('resolveProfileBox', () => {
  const boxes = [box('p1'), box('p2', 0.5)]

  it.each([
    ['the chosen photo', 'p2', 'p2'],
    ['the first box when nothing is chosen', undefined, 'p1'],
    // A removed photo or a box redrawn as absent must not blank the pic.
    ['the first box when the choice has no box', 'gone', 'p1'],
  ])('picks %s', (_, chosen, expected) => {
    expect(resolveProfileBox(boxes, chosen)?.photo_local_id).toBe(expected)
  })

  it('gives no Profile Pic for a cat described without a box', () => {
    expect(resolveProfileBox([], 'p1')).toBeUndefined()
  })
})

describe('toCachedCat', () => {
  it('stores the resolved crop so history survives draft teardown', () => {
    const cached = toCachedCat(
      observedCat({
        photo_local_ids: ['p1', 'p2'],
        profile_photo_local_id: 'gone',
      }),
      [box('p1'), box('p2', 0.5)],
    )
    expect(cached.profile_photo_local_id).toBe('p1')
    expect(cached.profile_box).toEqual({
      photo_local_id: 'p1',
      lowerLeftX: 0.1,
      lowerLeftY: 0.6,
      upperRightX: 0.9,
      upperRightY: 0.3,
    })
  })
})
