/** A burst stays bounded, and a failed upload cannot strand queued photos. */
import type { PhotoUploadResponse, SubmissionPhoto } from '@/src/types'
import {
  cancelQueuedUploads,
  uploadNewPhoto,
} from '@/src/lib/upload/uploadNewPhoto'

const mockPending: {
  resolve: (value: PhotoUploadResponse) => void
  reject: (error: Error) => void
}[] = []
let mockInFlight = 0
let mockPeakInFlight = 0

jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  uploadSubmissionPhoto: jest.fn(
    () =>
      new Promise<PhotoUploadResponse>((resolve, reject) => {
        mockInFlight += 1
        mockPeakInFlight = Math.max(mockPeakInFlight, mockInFlight)
        mockPending.push({
          resolve: (value) => {
            mockInFlight -= 1
            resolve(value)
          },
          reject: (error) => {
            mockInFlight -= 1
            reject(error)
          },
        })
      }),
  ),
}))

const photo = (n: number): SubmissionPhoto => ({
  local_id: `photo-${n}`,
  uri: `file:///cache/${n}.jpg`,
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
})

const drainTasks = () => new Promise((resolve) => setImmediate(resolve))

// Module-level fakes: each test starts with nothing in flight.
beforeEach(() => {
  mockPending.length = 0
  mockInFlight = 0
  mockPeakInFlight = 0
})
afterEach(() => jest.restoreAllMocks())

it('caps a burst at two uploads and drains queued photos after one fails', async () => {
  const failure = new Error('connection lost')
  const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
  const updatePhoto = jest.fn()
  const burstLength = 6

  for (let n = 0; n < burstLength; n += 1) {
    uploadNewPhoto(photo(n), 'uid', 'submission', updatePhoto)
  }
  expect(mockPeakInFlight).toBe(2)

  mockPending.shift()!.reject(failure)
  await drainTasks()
  expect(mockInFlight).toBe(2)
  expect(logError).toHaveBeenCalledWith('[uploadNewPhoto]', 'photo-0', failure)

  // Each completion must release a slot until the rest of the burst finishes.
  for (let n = 1; n < burstLength; n += 1) {
    const pending = mockPending.shift()
    expect(pending).toBeDefined()
    pending!.resolve({
      cloud_storage_path: `photo-${n}.jpg`,
      cloud_storage_url: `https://example.com/${n}.jpg`,
    })
    await drainTasks()
  }

  expect(mockPeakInFlight).toBe(2)
  expect(mockInFlight).toBe(0)
  expect(mockPending).toHaveLength(0)
  expect(updatePhoto).toHaveBeenCalledTimes(burstLength - 1)
  expect(updatePhoto).not.toHaveBeenCalledWith('photo-0', expect.anything())
  for (let n = 1; n < burstLength; n += 1) {
    expect(updatePhoto).toHaveBeenCalledWith(`photo-${n}`, {
      uploaded: true,
      upload_progress: 100,
      cloud_storage_path: `photo-${n}.jpg`,
      cloud_storage_url: `https://example.com/${n}.jpg`,
    })
  }
})

it('retries a failed photo once, and a torn-down draft gets no results', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const updatePhoto = jest.fn()

  // Queued twice (Details opened, then Submit): one upload, not two.
  uploadNewPhoto(photo(10), 'uid', 'submission', updatePhoto)
  uploadNewPhoto(photo(10), 'uid', 'submission', updatePhoto)
  expect(mockPending).toHaveLength(1)
  mockPending.shift()!.reject(new Error('offline'))
  await drainTasks()

  // After the failure, a retry runs it again.
  uploadNewPhoto(photo(10), 'uid', 'submission', updatePhoto)
  expect(mockPending).toHaveLength(1)

  // Reset lands mid-upload: the late result must not reach the next draft.
  cancelQueuedUploads()
  mockPending.shift()!.resolve({
    cloud_storage_path: 'photo-10.jpg',
    cloud_storage_url: 'https://example.com/10.jpg',
  })
  await drainTasks()
  expect(updatePhoto).not.toHaveBeenCalled()
})
