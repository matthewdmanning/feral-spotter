/**
 * The upload queue's two load-bearing promises: a burst cannot fan out one
 * upload per frame, and the queue always drains.
 */

import type { SubmissionPhoto } from '@/src/types'

const mockResolvers: ((value: {
  cloud_storage_path: string
  cloud_storage_url: string
}) => void)[] = []
let mockInFlight = 0
let mockPeakInFlight = 0

jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  uploadSubmissionPhoto: jest.fn(
    () =>
      new Promise((resolve) => {
        mockInFlight += 1
        mockPeakInFlight = Math.max(mockPeakInFlight, mockInFlight)
        mockResolvers.push((value) => {
          mockInFlight -= 1
          resolve(value)
        })
      }),
  ),
}))

import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'

const photo = (n: number): SubmissionPhoto => ({
  local_id: `photo-${n}`,
  uri: `file:///cache/${n}.jpg`,
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
})

const flush = () => new Promise((resolve) => setImmediate(resolve))

it('never runs more than two uploads at once and drains every one', async () => {
  const updatePhoto = jest.fn()
  const burstLength = 6

  for (let n = 0; n < burstLength; n += 1) {
    uploadNewPhoto(photo(n), 'uid', 'submission', updatePhoto)
  }
  await flush()

  expect(mockPeakInFlight).toBe(2)

  // Settle them the way the network would, one at a time, and confirm the
  // queue keeps feeding itself until nothing is left.
  for (let settled = 0; settled < burstLength; settled += 1) {
    const resolve = mockResolvers.shift()
    expect(resolve).toBeDefined()
    resolve?.({ cloud_storage_path: 'p', cloud_storage_url: 'u' })
    await flush()
  }

  expect(mockPeakInFlight).toBe(2)
  expect(mockInFlight).toBe(0)
  expect(updatePhoto).toHaveBeenCalledTimes(burstLength)
  for (let n = 0; n < burstLength; n += 1) {
    expect(updatePhoto).toHaveBeenCalledWith(
      `photo-${n}`,
      expect.objectContaining({ uploaded: true, upload_progress: 100 }),
    )
  }
})
