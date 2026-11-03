import type { AuthBlockingEvent } from 'firebase-functions/v2/identity'

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
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

import { resolveTesterClaim, sweepPhotosWithoutMetadata } from '../index'

function authEvent(
  data: Partial<AuthBlockingEvent['data']>,
): AuthBlockingEvent {
  return { data } as AuthBlockingEvent
}

// photoCount triggers: see photoCount.test.ts (event-sequence model).

// Submission cap: see submissionCap.test.ts.

describe('resolveTesterClaim', () => {
  const ORIGINAL_ENV = process.env.TESTER_ALLOWLIST_EMAILS

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetFiles.mockReset()
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
    mockGetFiles.mockReset()
    jest.spyOn(Date, 'now').mockReturnValue(now)
    mockDeleteFile.mockReset().mockResolvedValue(undefined)
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => jest.restoreAllMocks())

  // A prefix split across listing pages must be judged as a whole: its
  // metadata.json on page 2 still protects its photo on page 1.
  it('reads every listing page before deciding a prefix', async () => {
    mockGetFiles
      .mockResolvedValueOnce([
        [object('submissions/u/kept/photo.jpg', old)],
        { pageToken: 'p2' },
      ])
      .mockResolvedValueOnce([
        [
          object('submissions/u/kept/metadata.json', old),
          object('submissions/u/orphan/photo.jpg', old),
        ],
      ])

    await sweepPhotosWithoutMetadata.run({
      scheduleTime: new Date(now).toISOString(),
    })

    expect(mockGetFiles).toHaveBeenCalledTimes(2)
    expect(mockGetFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageToken: 'p2' }),
    )
    expect(mockDeleteFile.mock.calls.map(([name]) => name)).toEqual([
      'submissions/u/orphan/photo.jpg',
    ])
  })

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

    expect(mockGetFiles).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'submissions/' }),
    )
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
