import { act, renderHook, waitFor } from '@testing-library/react-native'

import * as cache from '@/src/features/draft-submission/lib/submissionCache'
import { observedCat } from '@/src/test-utils/catFixtures'
import { useDraftSync } from '@/src/features/draft-submission/hooks/useDraftSync'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({ status: 'idle', result: null }),
}))

const rowCats = async () => (await cache.getSubmissionCache('cache-1'))?.cats

/**
 * The Reports card of an In Progress draft reads its cat count from the
 * cache row, so the row must follow the draft's cats before Submit. A sent
 * row must keep the cats Submit wrote when clearDraft() empties the store.
 */
it('draft cats reach the In Progress row and survive the post-Submit clear', async () => {
  useSubmissionStore.getState().clearDraft()
  await cache.createSubmissionCache('cache-1', {
    location_method: 'device',
    time_method: 'device',
  })
  const read = jest.spyOn(cache, 'getSubmissionCache')
  const update = jest.spyOn(cache, 'updateSubmissionCache')
  renderHook(() => useDraftSync())

  // A cat saved in Cat Form shows on the In Progress card.
  act(() => useSubmissionStore.getState().addCat(observedCat()))
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      'cache-1',
      expect.objectContaining({ cats: [expect.anything()] }),
    ),
  )
  await act(async () => {})
  expect(await rowCats()).toHaveLength(1)

  // Submit sends the row, then clears the draft.
  await cache.updateSubmissionCache('cache-1', { status: 'Submitted' })
  read.mockClear()
  update.mockClear()
  act(() => useSubmissionStore.getState().clearDraft())

  // The sync has read the row and decided; only then is "no write" proof.
  await waitFor(() => expect(read).toHaveBeenCalled())
  await act(async () => {})
  expect(update).not.toHaveBeenCalled()
  expect(await rowCats()).toHaveLength(1)
})
