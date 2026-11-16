import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import type { PhotoUploadResponse } from '@/src/shared/types'
import {
  deleteSubmissionPhoto,
  uploadSubmissionPhoto,
} from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import {
  cancelPhotoUploads,
  deletePhotoUploads,
  syncPhotoUploads,
  whenUploadsSettled,
} from '@/src/features/draft-submission/lib/upload/draftUploads'
import {
  cancelPhotoUpload,
  uploadNewPhoto,
} from '@/src/features/draft-submission/lib/upload/uploadNewPhoto'

/**
 * Submit waits on these outcomes. A failed upload used to be noticed only
 * after a 30 s poll; it must be reported as soon as nothing is uploading.
 * Every upload must carry the photo's stored slot.
 */

// jest-expo's expo-crypto mock returns undefined; the draft needs an id.
let mockId = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockId}` }))
jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  deleteSubmissionPhoto: jest.fn(),
  uploadSubmissionPhoto: jest.fn(),
}))

const photo = (n: number) => ({
  local_id: `p${n}`,
  uri: `file:///p${n}.jpg`,
  uploaded: false,
  upload_progress: 0,
  width: 10,
  height: 10,
})
const flush = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  cancelPhotoUploads()
  usePhotoStore.getState().clearPhotos(true)
  useAuthStore.setState({ user: { uid: 'u1' } as never, isReady: true })
})
afterEach(() => jest.restoreAllMocks())

it('uploads the stored, slotted copy and reports uploaded', async () => {
  jest.mocked(uploadSubmissionPhoto).mockResolvedValue({
    cloud_storage_path: 'path',
    cloud_storage_url: 'url',
  })
  usePhotoStore.getState().addPhotos([photo(1)])
  syncPhotoUploads()
  await expect(whenUploadsSettled(30_000)).resolves.toBe('uploaded')
  expect(jest.mocked(uploadSubmissionPhoto).mock.calls[0][0]).toEqual(
    expect.objectContaining({ local_id: 'p1', upload_slot: 0 }),
  )
})

it('keeps a legacy JPEG-only upload retryable until its local DNG succeeds', async () => {
  jest
    .mocked(uploadSubmissionPhoto)
    .mockRejectedValueOnce(new Error('dng offline'))
    .mockResolvedValueOnce({
      cloud_storage_path: 'jpeg-path',
      cloud_storage_url: 'jpeg-url',
      raw_cloud_storage_path: 'dng-path',
      raw_cloud_storage_url: 'dng-url',
    })
  usePhotoStore.getState().addPhotos([
    {
      ...photo(4),
      uploaded: true,
      cloud_storage_path: 'jpeg-path',
      cloud_storage_url: 'jpeg-url',
      raw_uri: 'file:///p4.dng',
    },
  ])

  syncPhotoUploads()
  await expect(whenUploadsSettled(30_000)).resolves.toBe('failed')
  expect(usePhotoStore.getState().photos[0]).toEqual(
    expect.objectContaining({ uploaded: false, raw_uri: 'file:///p4.dng' }),
  )

  syncPhotoUploads()
  await expect(whenUploadsSettled(30_000)).resolves.toBe('uploaded')
  expect(usePhotoStore.getState().photos[0]).toEqual(
    expect.objectContaining({
      uploaded: true,
      raw_cloud_storage_path: 'dng-path',
    }),
  )
})

it('reports failed as soon as the last upload fails, not at the timeout', async () => {
  jest.mocked(uploadSubmissionPhoto).mockRejectedValue(new Error('offline'))
  usePhotoStore.getState().addPhotos([photo(2)])
  syncPhotoUploads()
  const started = Date.now()
  await expect(whenUploadsSettled(30_000)).resolves.toBe('failed')
  expect(Date.now() - started).toBeLessThan(5_000)
})

it('reports timeout while an upload is still running', async () => {
  jest.useFakeTimers()
  jest.mocked(uploadSubmissionPhoto).mockReturnValue(new Promise(() => {}))
  usePhotoStore.getState().addPhotos([photo(3)])
  syncPhotoUploads()
  const outcome = whenUploadsSettled(30_000)
  jest.advanceTimersByTime(30_000)
  await expect(outcome).resolves.toBe('timeout')
  jest.useRealTimers()
  await flush()
})

it('waits for canceled-pair deletion before reusing its slot', async () => {
  const oldPhoto = {
    ...photo(5),
    upload_slot: 0,
    raw_uri: 'file:///p5.dng',
  }
  const replacement = { ...photo(6), upload_slot: 0 }
  // Use explicit deferreds so this test observes the remote mutation order.
  let finishOld!: (value: PhotoUploadResponse) => void
  let finishDelete!: () => void
  const events: string[] = []
  jest.mocked(uploadSubmissionPhoto).mockReset()
  jest.mocked(uploadSubmissionPhoto).mockImplementationOnce(() => {
    events.push('upload-old')
    return new Promise((resolve) => {
      finishOld = resolve
    })
  })
  jest.mocked(uploadSubmissionPhoto).mockImplementationOnce(() => {
    events.push('upload-replacement')
    return Promise.resolve({
      cloud_storage_path: 'replacement.jpg',
      cloud_storage_url: 'replacement-url',
    })
  })
  jest.mocked(deleteSubmissionPhoto).mockImplementationOnce(() => {
    events.push('delete-old-pair')
    return new Promise((resolve) => {
      finishDelete = resolve
    })
  })
  const updatePhoto = jest.fn()

  uploadNewPhoto(oldPhoto, 'u1', 'sub1', updatePhoto)
  cancelPhotoUpload(oldPhoto.local_id)
  deletePhotoUploads(oldPhoto, 'u1', 'sub1')
  uploadNewPhoto(replacement, 'u1', 'sub1', updatePhoto)

  finishOld({
    cloud_storage_path: 'old.jpg',
    cloud_storage_url: 'old-url',
    raw_cloud_storage_path: 'old.dng',
    raw_cloud_storage_url: 'old-raw-url',
  })
  await flush()
  expect(events).toEqual(['upload-old', 'delete-old-pair'])

  finishDelete()
  await flush()
  expect(events).toEqual([
    'upload-old',
    'delete-old-pair',
    'upload-replacement',
  ])
  await flush()
  expect(updatePhoto).toHaveBeenLastCalledWith(replacement.local_id, {
    uploaded: true,
    upload_progress: 100,
    cloud_storage_path: 'replacement.jpg',
    cloud_storage_url: 'replacement-url',
    raw_cloud_storage_path: undefined,
    raw_cloud_storage_url: undefined,
  })
})
