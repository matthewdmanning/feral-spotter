import {
  deleteObject,
  getMetadata,
  listAll,
  putFile,
  ref,
  updateMetadata,
  uploadString,
} from '@react-native-firebase/storage'
import type { SubmissionApiPayload } from '@/src/types'
import {
  deleteSubmissionUploads,
  finalizeSubmissionPhotoMetadata,
  uploadSubmissionMetadata,
  uploadSubmissionPhoto,
} from '../firebaseUpload'

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

describe('Firebase submission upload behavior', () => {
  it('writes the serialized submission to its owned metadata object as JSON', async () => {
    const payload = { id: 'sub-7', photos: [{ cloud_storage_path: 'p.jpg' }] }

    await uploadSubmissionMetadata(
      payload as unknown as SubmissionApiPayload,
      'user-4',
      'sub-7',
    )

    expect(ref).toHaveBeenCalledWith(
      expect.anything(),
      'submissions/user-4/sub-7/metadata.json',
    )
    expect(uploadString).toHaveBeenCalledWith(
      expect.objectContaining({
        fullPath: 'submissions/user-4/sub-7/metadata.json',
      }),
      JSON.stringify(payload),
      'raw',
      { contentType: 'application/json' },
    )
  })

  it('preserves existing custom metadata and stamps finalized fields from object metadata', async () => {
    jest.mocked(getMetadata).mockResolvedValueOnce({
      timeCreated: '2026-04-02T03:04:05.000Z',
      customMetadata: { source: 'camera', keep: 'yes' },
    } as never)

    await finalizeSubmissionPhotoMetadata(
      'submissions/user-4/sub-7/photo.jpg',
      'user-4',
      '2026-04-01T00:00:00.000Z',
      34.1,
      -82.2,
    )

    const objectRef = expect.objectContaining({
      fullPath: 'submissions/user-4/sub-7/photo.jpg',
    })
    expect(getMetadata).toHaveBeenCalledWith(objectRef)
    expect(updateMetadata).toHaveBeenCalledWith(objectRef, {
      customMetadata: {
        source: 'camera',
        keep: 'yes',
        photo_time: '2026-04-01T00:00:00.000Z',
        upload_time: '2026-04-02T03:04:05.000Z',
        user_id: 'user-4',
        location_lat: '34.1',
        location_lng: '-82.2',
      },
    })
  })

  it('limits discard cleanup to the user submission folder and continues after individual delete failures', async () => {
    const first = { fullPath: 'submissions/user-4/sub-7/a.jpg' }
    const second = { fullPath: 'submissions/user-4/sub-7/b.jpg' }
    jest
      .mocked(listAll)
      .mockResolvedValueOnce({ items: [first, second], prefixes: [] } as never)
    const failure = new Error('offline')
    jest
      .mocked(deleteObject)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined as never)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await deleteSubmissionUploads('user-4', 'sub-7')

    expect(listAll).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: 'submissions/user-4/sub-7' }),
    )
    expect(deleteObject).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(
      '[firebaseUpload] best-effort delete failed for submissions/user-4/sub-7/a.jpg',
      failure,
    )
  })
  it('allows offline discard when listing uploads fails and reports the skipped cleanup', async () => {
    const failure = new Error('listing offline')
    jest.mocked(listAll).mockRejectedValueOnce(failure)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      deleteSubmissionUploads('user-4', 'sub-7'),
    ).resolves.toBeUndefined()

    expect(listAll).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: 'submissions/user-4/sub-7' }),
    )
    expect(deleteObject).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[firebaseUpload] best-effort cleanup skipped for submissions/user-4/sub-7',
      failure,
    )
  })
})

// The object path is what storage.rules' ownership check, the photo
// cap (photo-0 … photo-9) and the orphan sweep all key on; the percent
// drives the progress bar.
describe('uploadSubmissionPhoto', () => {
  const photo = (uri: string) => ({
    local_id: 'photo-9',
    uri,
    uploaded: false,
    upload_progress: 0,
    width: 10,
    height: 10,
    upload_slot: 3,
  })

  it.each([
    ['file:///cache/a.jpg', 'jpg'],
    ['file:///cache/A.JPG', 'jpg'],
    ['file:///cache/a.heic', 'heic'],
    ['file:///cache/no-extension', 'jpg'],
  ])('stores %s under the owner path with .%s', async (uri, ext) => {
    const result = await uploadSubmissionPhoto(photo(uri), 'uid-1', 'sub-1')
    const path = `submissions/uid-1/sub-1/photo-3.${ext}`
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: path }),
      uri,
    )
    expect(result).toEqual({
      cloud_storage_path: path,
      cloud_storage_url: 'https://example.com/mock.jpg',
    })
  })

  it('refuses a photo with no slot rather than write a name the rules deny', async () => {
    await expect(
      uploadSubmissionPhoto(
        { ...photo('file:///cache/a.jpg'), upload_slot: undefined },
        'uid-1',
        'sub-1',
      ),
    ).rejects.toThrow('has no slot')
    expect(putFile).not.toHaveBeenCalled()
  })

  it('reports progress as a percent of bytes sent', async () => {
    jest.mocked(putFile).mockImplementationOnce(() => {
      const task = Promise.resolve() as Promise<void> & {
        on: (event: string, handler: (s: object) => void) => void
      }
      task.on = (_event, handler) =>
        handler({ bytesTransferred: 250, totalBytes: 1000 })
      return task as never
    })
    const onProgress = jest.fn()
    await uploadSubmissionPhoto(
      photo('file:///cache/a.jpg'),
      'uid-1',
      'sub-1',
      onProgress,
    )
    expect(onProgress).toHaveBeenCalledWith(25)
  })
})
