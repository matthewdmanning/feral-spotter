import type { StorageEvent } from 'firebase-functions/v2/storage'

/**
 * #270 without a database: the cap claim must follow the uid's count of
 * metadata.json objects, in both directions, and must keep the uid's
 * other claims. Storage and Auth are faked at their Admin SDK boundary.
 */

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }))

const mockObjects = new Set<string>()
const mockClaims = new Map<string, Record<string, unknown>>()
const mockMissing = new Set<string>()

jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      getFiles: async ({
        prefix,
        matchGlob,
      }: {
        prefix: string
        matchGlob: string
      }) => {
        const suffix = matchGlob.replace('**/', '/')
        return [
          [...mockObjects]
            .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
            .map((name) => ({ name })),
        ]
      },
    }),
  }),
}))
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: async (uid: string) => {
      if (mockMissing.has(uid)) {
        throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' })
      }
      return { uid, customClaims: mockClaims.get(uid) }
    },
    setCustomUserClaims: async (
      uid: string,
      claims: Record<string, unknown>,
    ) => {
      mockClaims.set(uid, claims)
    },
  }),
}))

import {
  MAX_SUBMISSIONS_PER_UID,
  SUBMISSION_CAP_CLAIM,
  onSubmissionDeleted,
  onSubmissionSubmitted,
} from '../index'

const metadata = (uid: string, n: number) =>
  `submissions/${uid}/sub-${n}/metadata.json`
const storageEvent = (name: string) =>
  ({ data: { name } }) as unknown as StorageEvent

beforeEach(() => {
  mockObjects.clear()
  mockClaims.clear()
  mockMissing.clear()
})

it('sets the claim at the cap, keeps other claims, and clears it below the cap', async () => {
  mockClaims.set('u1', { allowedTester: true })
  for (let n = 0; n < MAX_SUBMISSIONS_PER_UID - 1; n += 1) {
    mockObjects.add(metadata('u1', n))
  }
  // Photos and another uid sharing the prefix's first characters do not count.
  mockObjects.add('submissions/u1/sub-0/photo-0.jpg')
  for (let n = 0; n < 5; n += 1) mockObjects.add(metadata('u10', n))

  const last = metadata('u1', MAX_SUBMISSIONS_PER_UID - 1)
  mockObjects.add(last)
  await onSubmissionSubmitted.run(storageEvent(last))
  expect(mockClaims.get('u1')).toEqual({
    allowedTester: true,
    [SUBMISSION_CAP_CLAIM]: true,
  })

  mockObjects.delete(last)
  await onSubmissionDeleted.run(storageEvent(last))
  expect(mockClaims.get('u1')?.[SUBMISSION_CAP_CLAIM]).toBe(false)
  expect(mockClaims.get('u1')?.allowedTester).toBe(true)
})

it('ignores photos and deleted accounts', async () => {
  await onSubmissionSubmitted.run(
    storageEvent('submissions/u1/sub-0/photo-0.jpg'),
  )
  expect(mockClaims.size).toBe(0)

  mockMissing.add('gone')
  await expect(
    onSubmissionDeleted.run(storageEvent(metadata('gone', 0))),
  ).resolves.toBeUndefined()
})
