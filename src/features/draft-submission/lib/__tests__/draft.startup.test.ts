import { SUBMISSION_STALE_MS } from '@/src/shared/config/constants'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { waitFor } from '@testing-library/react-native'
import { File, Paths } from 'expo-file-system'
import {
  createSubmissionCache,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/shared/lib/submissionCache'
import { deleteSubmissionUploads } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { discardUnsurvivingDraft } from '@/src/features/draft-submission/lib/draft'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'

/**
 * The start-up survival rule (#424): a draft outlives the process only while
 * it holds a photo and was last changed within SUBMISSION_STALE_MS. Real
 * stores, so a field the teardown forgets would show here.
 */

jest.mock('@/src/core/location/liveFix', () => ({
  stopLocationCapture: jest.fn(),
}))
jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  deleteSubmissionUploads: jest.fn(),
}))
jest.mock('@/src/features/auth/lib', () => ({
  authProvider: {
    getCurrentUser: () => ({ uid: 'uid-test' }),
    onAuthStateChanged: () => () => {},
  },
}))

const NOW = Date.UTC(2026, 9, 31, 12)
const HOUR_MS = 60 * 60 * 1000
const CACHE_ID = 'cache-1'

const seedDraft = (updatedAt: number | null) => {
  useSubmissionStore.getState().setSubmission({ address: 'Draft address' })
  usePhotoStore
    .getState()
    .addPhoto(submissionPhoto({ uri: 'file://photo-1.jpg' }))
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

  it('signals capture readiness after a surviving draft is decided', async () => {
    seedDraft(NOW - SUBMISSION_STALE_MS + HOUR_MS)
    const onCaptureReady = jest.fn(() =>
      usePhotoStore.getState().addPhoto(
        submissionPhoto({
          local_id: 'photo-new',
          uri: 'file://photo-new.jpg',
        }),
      ),
    )

    await discardUnsurvivingDraft(NOW, onCaptureReady)

    expect(onCaptureReady).toHaveBeenCalledTimes(1)
    expect(usePhotoStore.getState().photos.map((p) => p.local_id)).toEqual([
      'photo-1',
      'photo-new',
    ])
  })

  it('discards the whole draft once its last change is past the window', async () => {
    seedDraft(NOW - SUBMISSION_STALE_MS - HOUR_MS)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(0)
    expect(usePhotoStore.getState().source).toBeNull()
    expect(useSubmissionStore.getState().submission.address).toBeUndefined()
  })

  it.each([
    ['fresh', NOW - HOUR_MS],
    ['stale', NOW - SUBMISSION_STALE_MS - HOUR_MS],
  ])(
    'keeps a %s draft killed mid-send in the bucket and marks it Failed',
    async (_label, updatedAt) => {
      // The app died after Submit started: metadata.json may have landed,
      // so its objects are the user's Sighting, not abandoned uploads.
      seedDraft(updatedAt)
      await createSubmissionCache(CACHE_ID, {
        location_method: 'device',
        time_method: 'device',
      })
      await updateSubmissionCache(CACHE_ID, { status: 'Sending' })
      await discardUnsurvivingDraft(NOW)
      expect(deleteSubmissionUploads).not.toHaveBeenCalled()
      expect((await getSubmissionCache(CACHE_ID))?.status).toBe('Failed')
    },
  )

  it('signals readiness before stale cache cleanup and keeps new capture state', async () => {
    const oldFile = new File(Paths.cache, 'startup-old.jpg')
    const newFile = new File(Paths.cache, 'startup-new.jpg')
    oldFile.create()
    newFile.create()
    seedDraft(NOW - SUBMISSION_STALE_MS - HOUR_MS)
    usePhotoStore.setState({ submissionId: 'old-submission' })
    usePhotoStore.setState({
      photos: [
        {
          ...usePhotoStore.getState().photos[0],
          uri: oldFile.uri,
        },
      ],
    })
    await createSubmissionCache(CACHE_ID, {
      location_method: 'device',
      time_method: 'device',
    })

    const deleteStarted = Promise.withResolvers<void>()
    const deleteGate = Promise.withResolvers<void>()
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementation(async (key) => {
      if (key === `submission_cache_${CACHE_ID}`) {
        deleteStarted.resolve()
        await deleteGate.promise
      }
    })

    const startup = discardUnsurvivingDraft(NOW, () => {
      expect(oldFile.exists).toBe(true)
      usePhotoStore
        .getState()
        .addPhoto(submissionPhoto({ local_id: 'photo-new', uri: newFile.uri }))
    })

    await deleteStarted.promise
    expect(usePhotoStore.getState().photos.map((p) => p.local_id)).toEqual([
      'photo-new',
    ])
    deleteGate.resolve()
    await startup

    expect(deleteSubmissionUploads).toHaveBeenCalledWith(
      'uid-test',
      'old-submission',
    )
    // The old file's delete is fire-and-forget after startup resolves.
    await waitFor(() => expect(oldFile.exists).toBe(false))
    expect(newFile.exists).toBe(true)
  })

  it('discards draft data that has no photo behind it', async () => {
    useSubmissionStore.getState().setSubmission({ address: 'Orphan address' })
    await discardUnsurvivingDraft(NOW)
    expect(useSubmissionStore.getState().submission.address).toBeUndefined()
  })

  it('discards an undated pool even when its current cache row is fresh', async () => {
    seedDraft(null)
    await createSubmissionCache(CACHE_ID, {
      location_method: 'device',
      time_method: 'device',
    })
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(0)
    expect(usePhotoStore.getState().updated_at).toBeNull()
  })

  it('fails instead of hanging when rehydrate resolves without hydration', async () => {
    seedDraft(NOW - SUBMISSION_STALE_MS + HOUR_MS)
    const hasHydrated = jest
      .spyOn(usePhotoStore.persist, 'hasHydrated')
      .mockReturnValue(false)
    const rehydrate = jest
      .spyOn(usePhotoStore.persist, 'rehydrate')
      .mockResolvedValue(undefined)

    await expect(discardUnsurvivingDraft(NOW)).rejects.toThrow(
      'Could not restore draft state',
    )
    expect(usePhotoStore.getState().photos).toHaveLength(1)
    hasHydrated.mockRestore()
    rehydrate.mockRestore()
  })
})
