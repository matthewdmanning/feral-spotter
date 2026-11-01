import { SUBMISSION_STALE_MS } from '@/src/shared/config/constants'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { File, Paths } from 'expo-file-system'
import {
  createSubmissionCache,
  getSubmissionCache,
} from '@/src/features/draft-submission/lib/submissionCache'
import { deleteSubmissionUploads } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { discardUnsurvivingDraft } from '../draft'

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
  authProvider: { getCurrentUser: () => ({ uid: 'uid-test' }) },
}))

const NOW = Date.UTC(2026, 9, 31, 12)
const HOUR_MS = 60 * 60 * 1000
const CACHE_ID = 'cache-1'

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

// Use this function to seed a legacy draft cache with the supplied last-change timestamp for expiry tests.
const seedCache = async (updatedAt: string | undefined) => {
  await createSubmissionCache(CACHE_ID, {
    location_method: 'device',
    time_method: 'device',
  })
  const cache = await getSubmissionCache(CACHE_ID)
  if (!cache) throw new Error('Expected seeded cache')
  await AsyncStorage.setItem(
    `submission_cache_${CACHE_ID}`,
    JSON.stringify({ ...cache, updated_at: updatedAt }),
  )
}

describe('discardUnsurvivingDraft (#424)', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    useSubmissionStore.setState(useSubmissionStore.getInitialState(), true)
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    useBoundingBoxStore.setState(useBoundingBoxStore.getInitialState(), true)
    useActiveCatFlowStore.setState(
      useActiveCatFlowStore.getInitialState(),
      true,
    )
  })

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
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
      usePhotoStore.getState().addPhoto({
        local_id: 'photo-new',
        uri: 'file://photo-new.jpg',
        uploaded: false,
        upload_progress: 0,
        width: 100,
        height: 100,
      }),
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
    await seedCache(new Date(NOW - SUBMISSION_STALE_MS - HOUR_MS).toISOString())

    let releaseDelete!: () => void
    let signalDeleteStarted!: () => void
    const deleteStarted = new Promise<void>((resolve) => {
      signalDeleteStarted = resolve
    })
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementation(async (key) => {
      if (key === `submission_cache_${CACHE_ID}`) {
        signalDeleteStarted()
        await deleteGate
      }
    })

    const startup = discardUnsurvivingDraft(NOW, () => {
      expect(oldFile.exists).toBe(true)
      usePhotoStore.getState().addPhoto({
        local_id: 'photo-new',
        uri: newFile.uri,
        uploaded: false,
        upload_progress: 0,
        width: 100,
        height: 100,
      })
    })

    await deleteStarted
    expect(usePhotoStore.getState().photos.map((p) => p.local_id)).toEqual([
      'photo-new',
    ])
    releaseDelete()
    await startup

    expect(deleteSubmissionUploads).toHaveBeenCalledWith(
      'uid-test',
      'old-submission',
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(oldFile.exists).toBe(false)
    expect(newFile.exists).toBe(true)
  })

  it('discards draft data that has no photo behind it', async () => {
    useSubmissionStore.getState().setSubmission({ address: 'Orphan address' })
    await discardUnsurvivingDraft(NOW)
    expect(useSubmissionStore.getState().submission.address).toBeUndefined()
  })

  it('migrates a fresh cache age and expires on a later startup', async () => {
    seedDraft(null)
    const updatedAt = new Date(
      NOW - SUBMISSION_STALE_MS + HOUR_MS,
    ).toISOString()
    await seedCache(updatedAt)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(1)
    expect(usePhotoStore.getState().updated_at).toBe(
      new Date(updatedAt).getTime(),
    )
    const persisted = JSON.parse(
      (await AsyncStorage.getItem('photo-store')) as string,
    )
    expect(persisted.state.updated_at).toBe(new Date(updatedAt).getTime())

    await discardUnsurvivingDraft(NOW + SUBMISSION_STALE_MS + HOUR_MS)
    expect(usePhotoStore.getState().photos).toHaveLength(0)
  })

  it.each([
    [
      'a stale cache age',
      new Date(NOW - SUBMISSION_STALE_MS - HOUR_MS).toISOString(),
    ],
    ['an unreadable cache age', 'not-a-date'],
  ])('discards a legacy pool with %s', async (_label, updatedAt) => {
    seedDraft(null)
    await seedCache(updatedAt)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(0)
  })

  it('discards a legacy pool when its current cache row is missing', async () => {
    seedDraft(null)
    await discardUnsurvivingDraft(NOW)
    expect(usePhotoStore.getState().photos).toHaveLength(0)
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
