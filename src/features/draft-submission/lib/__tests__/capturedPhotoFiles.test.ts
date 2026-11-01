/** Cache-file ownership and gallery-save retention use Expo's native mock. */
import { File, Paths } from 'expo-file-system'
import {
  deleteCapturedPhotoFile,
  releaseCapturedPhotoFile,
  retainCapturedPhotoFile,
} from '@/src/features/draft-submission/lib/capturedPhotoFiles'

// The supplied mock helper is outside the package's public exports map.
const { __resetMockFileSystem } = jest.requireActual(
  require
    .resolve('expo-file-system/package.json')
    .replace('package.json', 'mocks/FileSystem.ts'),
)

beforeEach(() => {
  __resetMockFileSystem()
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('deletes a captured file inside the cache directory', () => {
  const file = new File(Paths.cache, 'capture.jpg')
  file.create()
  expect(file.exists).toBe(true)

  deleteCapturedPhotoFile(file.uri)
  expect(file.exists).toBe(false)
})

it.each([
  ['a document-directory file', () => new File(Paths.document, 'keep.jpg')],
  [
    'a gallery content uri',
    () => new File('content://media/external/images/1'),
  ],
  [
    'an unrelated absolute path',
    () => new File('file:///storage/emulated/0/DCIM/mine.jpg'),
  ],
])('leaves %s alone', (_why, buildFile) => {
  const file = buildFile()
  file.create({ intermediates: true })
  expect(file.exists).toBe(true)

  deleteCapturedPhotoFile(file.uri)
  expect(file.exists).toBe(true)
})

it('does not throw when the file is already gone', () => {
  const file = new File(Paths.cache, 'gone.jpg')
  const remove = jest.spyOn(File.prototype, 'delete')
  expect(file.exists).toBe(false)

  expect(() => deleteCapturedPhotoFile(file.uri)).not.toThrow()
  expect(remove).not.toHaveBeenCalled()
  expect(file.exists).toBe(false)
})

it('defers deletion until the gallery-save hold is released', () => {
  const file = new File(Paths.cache, 'held.jpg')
  file.create()
  retainCapturedPhotoFile(file.uri)
  deleteCapturedPhotoFile(file.uri)
  expect(file.exists).toBe(true)

  releaseCapturedPhotoFile(file.uri)
  expect(file.exists).toBe(false)
})

it('keeps deferred deletion through repeated gallery holds', () => {
  const file = new File(Paths.cache, 'repeated.jpg')
  file.create()
  retainCapturedPhotoFile(file.uri)
  deleteCapturedPhotoFile(file.uri)
  retainCapturedPhotoFile(file.uri)

  releaseCapturedPhotoFile(file.uri)
  expect(file.exists).toBe(true)

  releaseCapturedPhotoFile(file.uri)
  expect(file.exists).toBe(false)
})
