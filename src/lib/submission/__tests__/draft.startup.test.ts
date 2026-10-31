import { SUBMISSION_STALE_MS } from '@/src/config/constants'
import { useActiveCatFlowStore } from '@/src/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { discardUnsurvivingDraft } from '../draft'

/**
 * The start-up survival rule (#424): a draft outlives the process only while
 * it holds a photo and was last changed within SUBMISSION_STALE_MS. Real
 * stores, so a field the teardown forgets would show here.
 */

jest.mock('@/src/lib/location', () => ({ stopLocationCapture: jest.fn() }))
jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  deleteSubmissionUploads: jest.fn(),
}))
jest.mock('@/src/lib/auth', () => ({
  authProvider: { getCurrentUser: () => ({ uid: 'uid-test' }) },
}))

const NOW = Date.UTC(2026, 9, 31, 12)
const HOUR_MS = 60 * 60 * 1000

const seedDraft = (updatedAt: number | null) => {
  useSubmissionStore.getState().setSubmission({ address: 'Draft address' })
  usePhotoStore.getState().addPhoto({
    local_id: 'photo-1',
    uri: 'file://photo-1.jpg',
    uploaded: false,
    upload_progress: 0,
    width: 100,
    height: 100,
  })
  usePhotoStore.setState({ updated_at: updatedAt })
}

describe('discardUnsurvivingDraft (#424)', () => {
  beforeEach(() => {
    useSubmissionStore.setState(useSubmissionStore.getInitialState(), true)
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    useBoundingBoxStore.setState(useBoundingBoxStore.getInitialState(), true)
    useActiveCatFlowStore.setState(
      useActiveCatFlowStore.getInitialState(),
      true,
    )
  })

  it('keeps a draft with a photo changed inside the window', async () => {
    seedDraft(NOW - SUBMISSION_STALE_MS + HOUR_MS)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(1)
    expect(useSubmissionStore.getState().submission.address).toBe(
      'Draft address',
    )
  })

  it('discards the whole draft once its last change is past the window', async () => {
    seedDraft(NOW - SUBMISSION_STALE_MS - HOUR_MS)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(0)
    expect(usePhotoStore.getState().source).toBeNull()
    expect(useSubmissionStore.getState().submission.address).toBeUndefined()
  })

  it('discards draft data that has no photo behind it', async () => {
    useSubmissionStore.getState().setSubmission({ address: 'Orphan address' })
    await discardUnsurvivingDraft(NOW)
    expect(useSubmissionStore.getState().submission.address).toBeUndefined()
  })

  it('keeps a pool saved before updated_at existed', async () => {
    seedDraft(null)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(1)
  })
})
