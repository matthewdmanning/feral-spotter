const mockErase = jest.fn().mockResolvedValue(undefined)
jest.mock('../../organizations/store', () => ({
  eraseOrganizationData: (uid: string) => mockErase(uid),
}))
const mockDeleteFiles = jest.fn().mockResolvedValue(undefined)
const mockBucket = jest.fn(() => ({ deleteFiles: mockDeleteFiles }))

jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: mockBucket }),
}))

import { createStorageSubmissionStore } from '../adapters'

it('deletes the uid permissions prefix on every retry', async () => {
  const store = createStorageSubmissionStore('uploads')

  await store.deleteUserOrganizationPermissions('u1')
  await store.deleteUserOrganizationPermissions('u1')

  expect(mockErase).toHaveBeenNthCalledWith(1, 'u1')
  expect(mockErase).toHaveBeenNthCalledWith(2, 'u1')
  expect(mockBucket).toHaveBeenCalledWith('uploads')
  expect(mockDeleteFiles).toHaveBeenNthCalledWith(1, {
    prefix: 'organization-permissions/u1/',
  })
  expect(mockDeleteFiles).toHaveBeenNthCalledWith(2, {
    prefix: 'organization-permissions/u1/',
  })
})
