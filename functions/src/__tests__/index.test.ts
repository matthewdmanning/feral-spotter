import type {
  StorageEvent,
  StorageObjectData,
} from 'firebase-functions/v2/storage'
import type { CloudEvent } from 'firebase-functions/v2'
import type { AuthBlockingEvent } from 'firebase-functions/v2/identity'

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
}))

interface MockDocRef {
  id: string
  set: typeof mockSet
  collection: (name: string) => MockCollectionRef
}
interface MockCollectionRef {
  name: string
  doc: (id: string) => MockDocRef
}

const mockSet = jest.fn().mockResolvedValue(undefined)
const mockDoc = jest.fn((id: string): MockDocRef => ({
  id,
  set: mockSet,
  collection: mockCollection,
}))
const mockCollection = jest.fn((name: string): MockCollectionRef => ({
  name,
  doc: mockDoc,
}))
const mockIncrement = jest.fn((n: number) => ({ __increment: n }))

const mockTxGet = jest.fn()
const mockTxSet = jest.fn()
const mockRunTransaction = jest.fn(
  async (
    fn: (tx: { get: typeof mockTxGet; set: typeof mockTxSet }) => unknown,
  ) => fn({ get: mockTxGet, set: mockTxSet }),
)

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  })),
  FieldValue: { increment: (n: number) => mockIncrement(n) },
}))

const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined)
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ setCustomUserClaims: mockSetCustomUserClaims })),
}))

import {
  resolveTesterClaim,
  onSubmissionPhotoDeleted,
  onSubmissionPhotoUploaded,
  onSubmissionSubmitted,
} from '../index'

function event(
  name: string,
): CloudEvent<StorageObjectData> & { bucket: string } {
  return {
    bucket: 'feral-spotter-image-uploads',
    data: { name, bucket: 'feral-spotter-image-uploads' } as StorageObjectData,
  } as StorageEvent
}

function authEvent(
  data: Partial<AuthBlockingEvent['data']>,
): AuthBlockingEvent {
  return { data } as AuthBlockingEvent
}

describe('onSubmissionPhotoUploaded', () => {
  beforeEach(() => jest.clearAllMocks())

  it('increments photoCount and sets ownerUid for a well-formed path', async () => {
    mockTxGet.mockResolvedValueOnce({ get: () => undefined })

    await onSubmissionPhotoUploaded.run(
      event('submissions/uid-owner/sub-1/photo.jpg'),
    )

    expect(mockCollection).toHaveBeenCalledWith('submissions')
    expect(mockDoc).toHaveBeenCalledWith('sub-1')
    expect(mockIncrement).toHaveBeenCalledWith(1)
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.anything(),
      { ownerUid: 'uid-owner', photoCount: { __increment: 1 } },
      { merge: true },
    )
  })

  it('increments when the existing doc is owned by the same uid', async () => {
    mockTxGet.mockResolvedValueOnce({
      get: (field: string) => (field === 'ownerUid' ? 'uid-owner' : undefined),
    })

    await onSubmissionPhotoUploaded.run(
      event('submissions/uid-owner/sub-1/photo.jpg'),
    )

    expect(mockTxSet).toHaveBeenCalledWith(
      expect.anything(),
      { ownerUid: 'uid-owner', photoCount: { __increment: 1 } },
      { merge: true },
    )
  })

  it('#268: does not increment or flip ownership when submissionId collides with a different uid', async () => {
    mockTxGet.mockResolvedValueOnce({
      get: (field: string) => (field === 'ownerUid' ? 'uid-other' : undefined),
    })

    await onSubmissionPhotoUploaded.run(
      event('submissions/uid-owner/sub-1/photo.jpg'),
    )

    expect(mockTxSet).not.toHaveBeenCalled()
  })

  it('no-ops on a malformed path (no uid/submissionId segments)', async () => {
    await onSubmissionPhotoUploaded.run(event('not-a-submission-path.jpg'))

    expect(mockCollection).not.toHaveBeenCalled()
  })

  it('no-ops on a path missing the fileName segment', async () => {
    await onSubmissionPhotoUploaded.run(event('submissions/uid-owner/sub-1'))

    expect(mockCollection).not.toHaveBeenCalled()
  })

  it('no-ops on metadata.json — not a photo, must not move the counter', async () => {
    await onSubmissionPhotoUploaded.run(
      event('submissions/uid-owner/sub-1/metadata.json'),
    )

    expect(mockCollection).not.toHaveBeenCalled()
  })
})

describe('onSubmissionPhotoDeleted', () => {
  beforeEach(() => jest.clearAllMocks())

  it('decrements photoCount for a well-formed path', async () => {
    await onSubmissionPhotoDeleted.run(
      event('submissions/uid-owner/sub-1/photo.jpg'),
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

  it('no-ops on metadata.json deletion', async () => {
    await onSubmissionPhotoDeleted.run(
      event('submissions/uid-owner/sub-1/metadata.json'),
    )

    expect(mockCollection).not.toHaveBeenCalled()
  })
})

describe('onSubmissionSubmitted', () => {
  beforeEach(() => jest.clearAllMocks())

  it('#270: increments the per-uid submission count on a new metadata.json', async () => {
    mockTxGet.mockResolvedValueOnce({ exists: false })

    await onSubmissionSubmitted.run(
      event('submissions/uid-owner/sub-1/metadata.json'),
    )

    expect(mockCollection).toHaveBeenCalledWith('submissionCounts')
    expect(mockDoc).toHaveBeenCalledWith('uid-owner')
    expect(mockCollection).toHaveBeenCalledWith('items')
    expect(mockDoc).toHaveBeenCalledWith('sub-1')
    expect(mockTxSet).toHaveBeenCalledWith(expect.anything(), {})
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.anything(),
      { count: { __increment: 1 } },
      { merge: true },
    )
  })

  it('dedupes a metadata.json retry — does not double-count an existing marker', async () => {
    mockTxGet.mockResolvedValueOnce({ exists: true })

    await onSubmissionSubmitted.run(
      event('submissions/uid-owner/sub-1/metadata.json'),
    )

    expect(mockTxSet).not.toHaveBeenCalled()
  })

  it('no-ops on a photo upload (not metadata.json)', async () => {
    await onSubmissionSubmitted.run(
      event('submissions/uid-owner/sub-1/photo.jpg'),
    )

    expect(mockRunTransaction).not.toHaveBeenCalled()
  })
})

describe('resolveTesterClaim', () => {
  const ORIGINAL_ENV = process.env.TESTER_ALLOWLIST_EMAILS

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TESTER_ALLOWLIST_EMAILS =
      'tester@example.com, Other@Example.com'
  })

  afterAll(() => {
    process.env.TESTER_ALLOWLIST_EMAILS = ORIGINAL_ENV
  })

  it('sets allowedTester true for an allowlisted email (case-insensitive)', async () => {
    await resolveTesterClaim(
      authEvent({ uid: 'uid-1', email: 'OTHER@example.com', customClaims: {} }),
    )

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-1', {
      allowedTester: true,
    })
  })

  it('sets allowedTester false for a non-allowlisted email', async () => {
    await resolveTesterClaim(
      authEvent({
        uid: 'uid-2',
        email: 'stranger@example.com',
        customClaims: {},
      }),
    )

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-2', {
      allowedTester: false,
    })
  })

  it('is a no-op once the claim already matches (no redundant write)', async () => {
    await resolveTesterClaim(
      authEvent({
        uid: 'uid-1',
        email: 'tester@example.com',
        customClaims: { allowedTester: true },
      }),
    )

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled()
  })

  it('no-ops when there is no uid on the event', async () => {
    await resolveTesterClaim(
      authEvent({ email: 'tester@example.com', customClaims: {} }),
    )

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled()
  })
})
