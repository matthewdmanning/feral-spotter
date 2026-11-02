import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'

/**
 * storage.rules accepts only photo-0 … photo-9 in a Submission, so every
 * photo needs its own slot. Two photos sharing one would overwrite each
 * other's object; a reused slot would let a removed photo's late upload
 * land on its replacement.
 */

const photo = (n: number) => ({
  local_id: `p${n}`,
  uri: `file:///p${n}.jpg`,
  uploaded: false,
  upload_progress: 0,
  width: 10,
  height: 10,
})
const slots = () => usePhotoStore.getState().photos.map((p) => p.upload_slot)

beforeEach(() => usePhotoStore.getState().clearPhotos(true))

it('gives each photo a distinct slot and prefers a fresh one over a freed one', () => {
  usePhotoStore.getState().addPhotos([photo(0), photo(1), photo(2)])
  expect(slots()).toEqual([0, 1, 2])

  usePhotoStore.getState().removePhoto('p1')
  usePhotoStore.getState().addPhotos([photo(3)])
  // Slot 1 was freed, but 3 has never been used.
  expect(slots()).toEqual([0, 2, 3])
})

it('reuses a freed slot only once no fresh one is left, and never exceeds ten', () => {
  usePhotoStore
    .getState()
    .addPhotos(Array.from({ length: 10 }, (_, n) => photo(n)))
  usePhotoStore.getState().removePhoto('p4')
  usePhotoStore.getState().addPhotos([photo(10), photo(11)])

  const taken = slots()
  expect(taken).toHaveLength(10)
  expect(new Set(taken).size).toBe(10)
  expect(taken).toContain(4)
  expect(usePhotoStore.getState().photos.map((p) => p.local_id)).not.toContain(
    'p11',
  )
})
