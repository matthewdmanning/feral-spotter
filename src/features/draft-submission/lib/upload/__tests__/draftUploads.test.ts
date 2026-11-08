import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { uploadSubmissionPhoto } from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import {
  cancelPhotoUploads,
  syncPhotoUploads,
  whenUploadsSettled,
} from '@/src/features/draft-submission/lib/upload/draftUploads'

/**
 * Submit waits on these outcomes. A failed upload used to be noticed only
 * after a 30 s poll; it must be reported as soon as nothing is uploading.
 * Every upload must carry the photo's stored slot.
 */

// jest-expo's expo-crypto mock returns undefined; the draft needs an id.
let mockId = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockId}` }))
jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
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
