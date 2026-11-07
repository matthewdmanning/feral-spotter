import { act, renderHook } from '@testing-library/react-native'

import * as cache from '@/src/lib/cache/submissionCache'
import { useDraftSync } from '../useDraftSync'
import { usePhotoStore } from '../usePhotoStore'
import { useSubmissionStore } from '../useSubmissionStore'

// jest-expo's expo-crypto mock returns undefined; rows need a real id.
jest.mock('expo-crypto', () => ({ randomUUID: () => 'row-new' }))
jest.mock('@/src/lib/location', () => ({
  useLocationCapture: () => ({ status: 'idle', result: null }),
}))

// #224 follow-up: opening Details with no row creates exactly one, carrying
// the photos already in the draft; the post-Submit clear must not mint a
// second, empty row.
it('creates one row for a draft with none, and no stray row after Submit', async () => {
  useSubmissionStore.getState().clearDraft()
  await cache.clearCurrentCacheId()
  usePhotoStore.setState({ photos: [], source: null, submissionId: 'sub-1' })
  usePhotoStore.getState().addPhoto({
    local_id: 'photo-1',
    uri: 'file:///p1.jpg',
    uploaded: false,
    upload_progress: 0,
    width: 10,
    height: 10,
  })
  const before = (await cache.getAllSubmissionCaches()).length

  const { unmount } = renderHook(() => useDraftSync())
  // The row is written by an async effect chain; let it run out.
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
  expect(await cache.getAllSubmissionCaches()).toHaveLength(before + 1)
  const id = await cache.getCurrentCacheId()
  expect((await cache.getSubmissionCache(id!))?.photos).toHaveLength(1)

  // What completeDraft does: flip, release the pointer, clear the stores.
  await cache.updateSubmissionCache(id!, { status: 'Submitted' })
  await cache.clearCurrentCacheId()
  act(() => {
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.getState().clearPhotos(true)
  })
  await act(async () => {})
  unmount()
  expect(await cache.getAllSubmissionCaches()).toHaveLength(before + 1)
})
