import { act, renderHook } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Crypto from 'expo-crypto'
import { router } from 'expo-router'
import { Platform } from 'react-native'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import { usePhotoStore } from '../usePhotoStore'
import { useSubmissionStore } from '../useSubmissionStore'
import { useLibraryPhotoPicker } from '../useLibraryPhotoPicker'

// Avoid the unrelated hook barrel; keep both persisted stores real.
jest.mock('@/src/hooks', () => ({
  usePhotoStore: jest.requireActual('../usePhotoStore').usePhotoStore,
  useSubmissionStore: jest.requireActual('../useSubmissionStore')
    .useSubmissionStore,
}))
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }))
jest.mock('@/src/lib/upload/uploadNewPhoto', () => ({
  uploadNewPhoto: jest.fn(),
}))
jest.mock('@/src/lib/analytics/analytics', () => ({
  ...jest.requireActual('@/src/lib/analytics/analytics'),
  captureEvent: jest.fn(),
}))

const assets: ImagePicker.ImagePickerAsset[] = [
  {
    uri: 'file:///picker/one.jpg',
    width: 1200,
    height: 800,
    exif: { DateTime: '2026:10:23 12:30:00' },
  },
  {
    uri: 'file:///picker/two.jpg',
    width: 800,
    height: 1200,
    exif: { DateTime: '2026:10:22 09:00:00' },
  },
]

beforeEach(async () => {
  jest.clearAllMocks()
  let nextId = 0
  jest
    .spyOn(Crypto, 'randomUUID')
    .mockImplementation(
      () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
    )
  await usePhotoStore.persist.rehydrate()
  await useSubmissionStore.persist.rehydrate()
  usePhotoStore.setState({ photos: [], source: null, submissionId: null })
  useSubmissionStore.getState().clearDraft()
  useAuthStore.setState({ user: { uid: 'picker-user' }, isReady: true })
  jest.spyOn(ImagePicker, 'getMediaLibraryPermissionsAsync').mockResolvedValue({
    status: ImagePicker.PermissionStatus.GRANTED,
    granted: true,
    canAskAgain: true,
    expires: 'never',
  })
  jest.spyOn(ImagePicker, 'requestMediaLibraryPermissionsAsync')
})

afterEach(() => {
  jest.restoreAllMocks()
  useAuthStore.setState({ user: null })
})

it.each(['android', 'ios'] as const)(
  '%s: selects multiple images into a Library draft using the platform picker',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform)
    const launch = jest
      .spyOn(ImagePicker, 'launchImageLibraryAsync')
      .mockResolvedValue({ canceled: false, assets })
    const { result } = renderHook(() => useLibraryPhotoPicker())

    await act(async () => result.current.pickFromLibrary())

    // Removing legacy on Android restores the picker reported in #411.
    // iOS must keep its default picker. Both paths must keep multi-select,
    // full quality and EXIF (used for Submission time).
    expect(launch).toHaveBeenCalledWith({
      legacy: platform === 'android',
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    })
    expect(
      ImagePicker.requestMediaLibraryPermissionsAsync,
    ).not.toHaveBeenCalled()

    const { photos, source, submissionId, updatePhoto } =
      usePhotoStore.getState()
    expect(source).toBe('library')
    expect(submissionId).toEqual(expect.any(String))
    expect(photos).toHaveLength(2)
    assets.forEach((asset, index) => {
      expect(photos[index]).toEqual(
        expect.objectContaining({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          exif: expect.objectContaining({ timestamp: asset.exif?.DateTime }),
        }),
      )
      expect(uploadNewPhoto).toHaveBeenNthCalledWith(
        index + 1,
        photos[index],
        'picker-user',
        submissionId,
        updatePhoto,
      )
    })
    expect(useSubmissionStore.getState().submission).toEqual(
      expect.objectContaining({
        location_type: 'pin',
        time_type: 'device',
        captured_at: new Date(2026, 9, 22, 9, 0, 0).toISOString(),
      }),
    )
    expect(router.navigate).toHaveBeenCalledWith('/submission/create')
  },
)

it('Android: cancel leaves the draft intact; a subsequent pick can add a photo without EXIF', async () => {
  jest.replaceProperty(Platform, 'OS', 'android')
  jest
    .spyOn(ImagePicker, 'launchImageLibraryAsync')
    .mockResolvedValueOnce({
      canceled: true,
      assets: null,
    })
    .mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///picker/no-exif.jpg', width: 640, height: 480 }],
    })
  const initialSubmission = useSubmissionStore.getState().submission
  const { result } = renderHook(() => useLibraryPhotoPicker())

  await act(async () => result.current.pickFromLibrary())

  expect(usePhotoStore.getState()).toEqual(
    expect.objectContaining({ photos: [], source: null, submissionId: null }),
  )
  expect(useSubmissionStore.getState().submission).toEqual(initialSubmission)
  expect(router.navigate).not.toHaveBeenCalled()
  expect(uploadNewPhoto).not.toHaveBeenCalled()

  await act(async () => result.current.pickFromLibrary())

  expect(usePhotoStore.getState().photos).toHaveLength(1)
  expect(usePhotoStore.getState().source).toBe('library')
  expect(useSubmissionStore.getState().submission).toEqual(
    expect.objectContaining({ location_type: 'pin', time_type: 'manual' }),
  )
  expect(uploadNewPhoto).toHaveBeenCalledTimes(1)
  expect(router.navigate).toHaveBeenCalledTimes(1)
})
