const mockErase = jest.fn().mockResolvedValue(undefined)
jest.mock('../../organizations/store', () => ({
  eraseOrganizationData: (uid: string) => mockErase(uid),
}))
const mockRedact = jest.fn().mockResolvedValue(undefined)
jest.mock('../../organizations/interactions/store', () => ({
  redactErasedAuthor: (uid: string) => mockRedact(uid),
}))
const mockDeleteFiles = jest.fn().mockResolvedValue(undefined)
const mockBucket = jest.fn(() => ({ deleteFiles: mockDeleteFiles }))

jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: mockBucket }),
}))

import { createStorageSubmissionStore } from '../adapters'

it('erases Firestore organization data on every retry', async () => {
  const store = createStorageSubmissionStore('uploads')

  await store.deleteUserOrganizationPermissions('u1')
  await store.deleteUserOrganizationPermissions('u1')

  expect(mockErase).toHaveBeenNthCalledWith(1, 'u1')
  expect(mockErase).toHaveBeenNthCalledWith(2, 'u1')
  // LOGIC-6: pin comments and reactions are redacted after writes are blocked.
  expect(mockRedact).toHaveBeenCalledTimes(2)
  expect(mockErase.mock.invocationCallOrder[0]).toBeLessThan(
    mockRedact.mock.invocationCallOrder[0],
  )
  expect(mockBucket).not.toHaveBeenCalled()
  expect(mockDeleteFiles).not.toHaveBeenCalled()
})
