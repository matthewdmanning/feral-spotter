import { usePhotoStore } from '../usePhotoStore'

/**
 * Purpose: this reducer logic is what the Home screen's photo-source-
 * exclusivity gate (ADR 0002's "single-source by construction" amendment)
 * is built on — addPhoto/addPhotos pin `source`, and removePhoto must clear
 * it back to null at exactly the last photo, not before (would re-enable
 * the disabled entrypoint too early) or after (would leave both disabled
 * once the pool is genuinely empty).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

const photo = (id: string) => ({
  local_id: id,
  uri: `file://${id}.jpg`,
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
})

describe('usePhotoStore — photo-source tracking', () => {
  beforeEach(() => {
    usePhotoStore.setState({ photos: [], source: null })
  })

  it('addPhoto (camera-only call site) pins source to "camera"', () => {
    usePhotoStore.getState().addPhoto(photo('a'))
    expect(usePhotoStore.getState().source).toBe('camera')
  })

  it('addPhotos (library-only call site) pins source to "library"', () => {
    usePhotoStore.getState().addPhotos([photo('a'), photo('b')])
    expect(usePhotoStore.getState().source).toBe('library')
  })

  it('removePhoto clears source to null only at the last remaining photo', () => {
    usePhotoStore.getState().addPhoto(photo('a'))
    usePhotoStore.getState().addPhoto(photo('b'))

    usePhotoStore.getState().removePhoto('a')
    expect(usePhotoStore.getState().source).toBe('camera')

    usePhotoStore.getState().removePhoto('b')
    expect(usePhotoStore.getState().source).toBeNull()
  })

  it('clearPhotos resets both photos and source', () => {
    usePhotoStore.getState().addPhotos([photo('a')])
    usePhotoStore.getState().clearPhotos()
    expect(usePhotoStore.getState().photos).toEqual([])
    expect(usePhotoStore.getState().source).toBeNull()
  })
})
