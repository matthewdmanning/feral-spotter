/**
 * The guard that keeps cleanup from deleting a file the app does not own.
 * A library-picked photo can carry a uri outside the cache directory, and
 * deleting it would destroy the user's own photo.
 */

import { deleteCapturedPhotoFile } from '@/src/lib/camera/capturedPhotoFiles'

const mockDelete = jest.fn()
const mockExists = jest.fn(() => true)

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///app/cache/' } },
  File: class {
    uri: string
    constructor(uri: string) {
      this.uri = uri
    }
    get exists() {
      return mockExists()
    }
    delete() {
      mockDelete(this.uri)
    }
  },
}))

beforeEach(() => {
  mockDelete.mockClear()
  mockExists.mockReturnValue(true)
})

it('deletes a captured file inside the cache directory', () => {
  deleteCapturedPhotoFile('file:///app/cache/abc.jpg')
  expect(mockDelete).toHaveBeenCalledWith('file:///app/cache/abc.jpg')
})

it.each([
  ['a document-directory file', 'file:///app/documents/keep.jpg'],
  ['a gallery content uri', 'content://media/external/images/1'],
  ['an unrelated absolute path', 'file:///storage/emulated/0/DCIM/mine.jpg'],
])('leaves %s alone', (_why, uri) => {
  deleteCapturedPhotoFile(uri)
  expect(mockDelete).not.toHaveBeenCalled()
})

it('does not throw when the file is already gone', () => {
  mockExists.mockReturnValue(false)
  expect(() =>
    deleteCapturedPhotoFile('file:///app/cache/abc.jpg'),
  ).not.toThrow()
  expect(mockDelete).not.toHaveBeenCalled()
})
