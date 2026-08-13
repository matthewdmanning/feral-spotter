import type {
  StorageEvent,
  StorageObjectData,
} from 'firebase-functions/v2/storage'
import type { CloudEvent } from 'firebase-functions/v2'

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
}))

const mockSet = jest.fn().mockResolvedValue(undefined)
const mockDoc = jest.fn(() => ({ set: mockSet }))
const mockCollection = jest.fn(() => ({ doc: mockDoc }))
const mockIncrement = jest.fn((n: number) => ({ __increment: n }))

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ collection: mockCollection })),
  FieldValue: { increment: (n: number) => mockIncrement(n) },
}))

import { onSubmissionPhotoDeleted, onSubmissionPhotoUploaded } from '../index'

function event(
  name: string,
): CloudEvent<StorageObjectData> & { bucket: string } {
  return {
    bucket: 'feral-spotter-image-uploads',
    data: { name, bucket: 'feral-spotter-image-uploads' } as StorageObjectData,
  } as StorageEvent
}

describe('onSubmissionPhotoUploaded', () => {
  beforeEach(() => jest.clearAllMocks())

  it('increments photoCount and sets ownerUid for a well-formed path', async () => {
    await onSubmissionPhotoUploaded.run(
      event('submissions/uid-1/sub-1/photo.jpg'),
    )

    expect(mockCollection).toHaveBeenCalledWith('submissions')
    expect(mockDoc).toHaveBeenCalledWith('sub-1')
    expect(mockIncrement).toHaveBeenCalledWith(1)
    expect(mockSet).toHaveBeenCalledWith(
      { ownerUid: 'uid-1', photoCount: { __increment: 1 } },
      { merge: true },
    )
  })

  it('no-ops on a malformed path (no uid/submissionId segments)', async () => {
    await onSubmissionPhotoUploaded.run(event('not-a-submission-path.jpg'))

    expect(mockCollection).not.toHaveBeenCalled()
  })

  it('no-ops on a path missing the fileName segment', async () => {
    await onSubmissionPhotoUploaded.run(event('submissions/uid-1/sub-1'))

    expect(mockCollection).not.toHaveBeenCalled()
  })
})

describe('onSubmissionPhotoDeleted', () => {
  beforeEach(() => jest.clearAllMocks())

  it('decrements photoCount for a well-formed path', async () => {
    await onSubmissionPhotoDeleted.run(
      event('submissions/uid-1/sub-1/photo.jpg'),
    )

    expect(mockDoc).toHaveBeenCalledWith('sub-1')
    expect(mockIncrement).toHaveBeenCalledWith(-1)
    expect(mockSet).toHaveBeenCalledWith(
      { photoCount: { __increment: -1 } },
      { merge: true },
    )
  })

  it('no-ops on a malformed path', async () => {
    await onSubmissionPhotoDeleted.run(event('junk'))

    expect(mockCollection).not.toHaveBeenCalled()
  })
})
