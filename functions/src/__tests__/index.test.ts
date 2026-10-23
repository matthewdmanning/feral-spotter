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
  path: string
  set: (...args: unknown[]) => Promise<unknown>
  collection: (name: string) => MockCollectionRef
}
interface MockCollectionRef {
  name: string
  doc: (id: string) => MockDocRef
}

const mockSet = jest.fn<Promise<void>, unknown[]>().mockResolvedValue(undefined)
const mockDoc = jest.fn((documentPath: string): MockDocRef => ({
  id: documentPath.split('/').at(-1)!,
  path: documentPath,
  set: (...args: Parameters<typeof mockSet>) => mockSet(documentPath, ...args),
  collection: (name: string) => mockCollection(`${documentPath}/${name}`),
}))
const mockCollection = jest.fn((name: string): MockCollectionRef => ({
  name,
  doc: (id: string) => mockDoc(`${name}/${id}`),
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

const mockGetFiles = jest.fn()
const mockDeleteFile = jest.fn<Promise<void>, [string]>()
const mockBucket = jest.fn(() => ({
  getFiles: mockGetFiles,
  file: (name: string) => ({ delete: () => mockDeleteFile(name) }),
}))
jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: mockBucket }),
}))

import {
  resolveTesterClaim,
  onSubmissionPhotoDeleted,
  onSubmissionPhotoUploaded,
  onSubmissionSubmitted,
  sweepPhotosWithoutMetadata,
} from '../index'

function event(
  name: string,
): CloudEvent<StorageObjectData> & { bucket: string } {
  return {
    bucket: 'project-e3d5659d-bc4f-438f-88c.firebasestorage.app',
    data: {
      name,
      bucket: 'project-e3d5659d-bc4f-438f-88c.firebasestorage.app',
    } as StorageObjectData,
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
    expect(mockDoc).toHaveBeenCalledWith('submissions/sub-1')
    expect(mockIncrement).toHaveBeenCalledWith(1)
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'submissions/sub-1' }),
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
      expect.objectContaining({ path: 'submissions/sub-1' }),
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

    expect(mockDoc).toHaveBeenCalledWith('submissions/sub-1')
    expect(mockIncrement).toHaveBeenCalledWith(-1)
    expect(mockSet).toHaveBeenCalledWith(
      'submissions/sub-1',
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
    expect(mockDoc).toHaveBeenCalledWith('submissionCounts/uid-owner')
    expect(mockCollection).toHaveBeenCalledWith(
      'submissionCounts/uid-owner/items',
    )
    expect(mockDoc).toHaveBeenCalledWith(
      'submissionCounts/uid-owner/items/sub-1',
    )
    expect(mockTxGet).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'submissionCounts/uid-owner/items/sub-1',
      }),
    )
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'submissionCounts/uid-owner/items/sub-1',
      }),
      {},
    )
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'submissionCounts/uid-owner' }),
      { count: { __increment: 1 } },
      { merge: true },
    )
  })

  it('dedupes a metadata.json retry — does not double-count an existing marker', async () => {
    mockTxGet.mockResolvedValueOnce({ exists: true })

    await onSubmissionSubmitted.run(
      event('submissions/uid-owner/sub-1/metadata.json'),
    )

    expect(mockTxGet).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'submissionCounts/uid-owner/items/sub-1',
      }),
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
    if (ORIGINAL_ENV === undefined) delete process.env.TESTER_ALLOWLIST_EMAILS
    else process.env.TESTER_ALLOWLIST_EMAILS = ORIGINAL_ENV
  })

  it('sets allowedTester true for an allowlisted email (case-insensitive)', async () => {
    await resolveTesterClaim(
      authEvent({
        uid: 'uid-1',
        email: 'OTHER@example.com',
        customClaims: { researcher: true },
      }),
    )

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-1', {
      researcher: true,
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

describe('orphan-photo retention sweep', () => {
  const now = Date.parse('2026-10-23T12:00:00Z')
  const old = '2026-10-15T11:59:59Z'
  const cutoff = '2026-10-16T12:00:00Z'
  const fresh = '2026-10-23T11:00:00Z'
  const object = (name: string, updated?: string) => ({
    name,
    metadata: { updated },
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(now)
    mockDeleteFile.mockReset().mockResolvedValue(undefined)
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => jest.restoreAllMocks())

  it('deletes only old orphan prefixes even when another user has submitted the same id', async () => {
    mockGetFiles.mockResolvedValueOnce([
      [
        object('submissions/user-a/shared/photo.jpg', old),
        object('submissions/user-a/shared/metadata.json', old),
        object('submissions/user-b/shared/one.jpg', old),
        object('submissions/user-b/shared/two.jpg', old),
        object('outside/old.jpg', old),
      ],
    ])

    await sweepPhotosWithoutMetadata.run({
      scheduleTime: new Date(now).toISOString(),
    })

    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'submissions/' })
    expect(mockDeleteFile.mock.calls.map(([name]) => name)).toEqual([
      'submissions/user-b/shared/one.jpg',
      'submissions/user-b/shared/two.jpg',
    ])
  })

  it.each([
    { reason: 'one photo is recent', second: { updated: fresh } },
    {
      reason: 'one photo is exactly at the cutoff',
      second: { updated: cutoff },
    },
    { reason: 'one photo has no date', second: {} },
    {
      reason: 'one photo has an invalid date',
      second: { updated: 'not-a-date' },
    },
  ])('preserves an entire prefix when $reason', async ({ second }) => {
    mockGetFiles.mockResolvedValueOnce([
      [
        object('submissions/user-a/active/old.jpg', old),
        { name: 'submissions/user-a/active/other.jpg', metadata: second },
      ],
    ])

    await sweepPhotosWithoutMetadata.run({
      scheduleTime: new Date(now).toISOString(),
    })

    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('continues deleting other orphan files after one deletion rejects', async () => {
    const failure = new Error('temporary deletion failure')
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockDeleteFile.mockRejectedValueOnce(failure)
    mockGetFiles.mockResolvedValueOnce([
      [
        object('submissions/user-a/orphan/one.jpg', old),
        object('submissions/user-a/orphan/two.jpg', old),
      ],
    ])

    await sweepPhotosWithoutMetadata.run({
      scheduleTime: new Date(now).toISOString(),
    })

    expect(mockDeleteFile.mock.calls.map(([name]) => name)).toEqual([
      'submissions/user-a/orphan/one.jpg',
      'submissions/user-a/orphan/two.jpg',
    ])
    expect(error).toHaveBeenCalledWith(
      '[sweep] failed to delete submissions/user-a/orphan/one.jpg',
      failure,
    )
  })
})
