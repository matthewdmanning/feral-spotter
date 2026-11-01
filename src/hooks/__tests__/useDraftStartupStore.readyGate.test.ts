import {
  draftReadyOrAlert,
  useDraftStartupStore,
} from '@/src/hooks/useDraftStartupStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { discardUnsurvivingDraft } from '@/src/lib/submission/draft'

/**
 * Every draft action waits on the same gate. A failed restore tells the
 * user once and lets the action stop; the next tap retries.
 */
jest.mock('@/src/lib/submission/draft', () => ({
  discardUnsurvivingDraft: jest.fn(),
}))

const restore = discardUnsurvivingDraft as jest.Mock

beforeEach(() => {
  restore.mockReset()
  useDraftStartupStore.setState(useDraftStartupStore.getInitialState())
  useUIStore.setState(useUIStore.getInitialState())
})

const alertTitle = () => useUIStore.getState().dialog?.title

it('resolves false with an alert when the restore fails, then retries', async () => {
  restore.mockRejectedValueOnce(new Error('disk'))
  await expect(draftReadyOrAlert()).resolves.toBe(false)
  expect(alertTitle()).toBe('Could not restore your sighting')

  restore.mockResolvedValueOnce(undefined)
  await expect(draftReadyOrAlert()).resolves.toBe(true)
  expect(useDraftStartupStore.getState().phase).toBe('ready')
})
