import { act, renderHook } from '@testing-library/react-native'
import { deleteCapturedPhotoFile } from '@/src/lib/camera/capturedPhotoFiles'
import { useCapturedPhotoWorkflow } from '../useCapturedPhotoWorkflow'

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

let mockId = 0
jest.mock('expo-crypto', () => ({
  randomUUID: () => `photo-${++mockId}`,
}))

const mockAssetCreate = jest.fn()
const mockPermissionCheck = jest.fn(async () => true)
jest.mock('expo-media-library', () => ({
  get Asset() {
    return { create: mockAssetCreate }
  },
}))
jest.mock('@/src/lib/permissions/gallerySavePermission', () => ({
  gallerySavePermission: {
    check: (...args: unknown[]) => mockPermissionCheck(...args),
    request: jest.fn(async () => true),
  },
}))

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), navigate: jest.fn() },
  useIsFocused: () => true,
}))
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: jest.fn((value: unknown) => ({ value })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn((value: unknown) => value),
  Easing: { out: jest.fn(), quad: {} },
}))
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('@/src/components/atoms/CameraThumb', () => ({
  CameraThumb: 'CameraThumb',
}))
jest.mock('@/src/lib/upload/uploadNewPhoto', () => ({
  uploadNewPhoto: jest.fn(),
}))

const mockPhotoStoreState = {
  photos: [] as { local_id: string; uri: string }[],
  addPhoto: jest.fn((photo: { local_id: string; uri: string }) => {
    mockPhotoStoreState.photos.push(photo)
  }),
  removePhoto: jest.fn((localId: string) => {
    const photo = mockPhotoStoreState.photos.find(
      (item) => item.local_id === localId,
    )
    if (photo) deleteCapturedPhotoFile(photo.uri)
    mockPhotoStoreState.photos = mockPhotoStoreState.photos.filter(
      (item) => item.local_id !== localId,
    )
  }),
  updatePhoto: jest.fn(),
  submissionId: 'test-submission',
}
jest.mock('@/src/hooks', () => ({
  usePhotoStore: Object.assign(
    (select: (state: typeof mockPhotoStoreState) => unknown) =>
      select(mockPhotoStoreState),
    { getState: () => mockPhotoStoreState },
  ),
}))
jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (select: (state: object) => unknown) =>
    select({ settings: { keep_photos_on_device: true } }),
}))

const frame = (uri: string) => ({ uri, width: 100, height: 100 })

beforeEach(() => {
  mockDelete.mockClear()
  mockExists.mockReturnValue(true)
  mockAssetCreate.mockReset()
  mockAssetCreate.mockResolvedValue(undefined)
  mockPermissionCheck.mockReset()
  mockPermissionCheck.mockResolvedValue(true)
  mockPhotoStoreState.photos = []
  mockPhotoStoreState.addPhoto.mockClear()
  mockPhotoStoreState.removePhoto.mockClear()
  mockId = 0
})

it('uses the current captured photo count for the last thumbnail badge', () => {
  const { result } = renderHook(() => {
    const workflow = useCapturedPhotoWorkflow()
    const index = workflow.capturedPhotos.length - 1
    return {
      ...workflow,
      lastBadge:
        index >= 0
          ? (
              workflow.renderItem({
                item: workflow.capturedPhotos[index],
                index,
              }) as any
            ).props.badgeCount
          : 0,
    }
  })

  act(() => {
    result.current.persistCapturedPhoto(frame('file:///tmp/one.jpg'), 'one')
    result.current.persistCapturedPhoto(frame('file:///tmp/two.jpg'), 'two')
  })
  expect(result.current.lastBadge).toBe(2)

  act(() => {
    result.current.persistCapturedPhoto(frame('file:///tmp/three.jpg'), 'three')
  })
  expect(result.current.lastBadge).toBe(3)
})

it('holds a removed cache file until an active gallery save finishes', async () => {
  let resolveSave!: () => void
  mockAssetCreate.mockImplementationOnce(
    () => new Promise<void>((resolve) => (resolveSave = resolve)),
  )
  const { result } = renderHook(() => useCapturedPhotoWorkflow())

  act(() => {
    result.current.persistCapturedPhoto(
      frame('file:///app/cache/pending.jpg'),
      'capture',
    )
  })
  const flush = result.current.flushGallerySaves()
  await act(async () => {
    await Promise.resolve()
  })
  act(() => result.current.handleDiscardPhoto('photo-1'))
  expect(mockDelete).not.toHaveBeenCalled()

  await act(async () => {
    resolveSave()
    await flush
  })
  expect(mockDelete).toHaveBeenCalledWith('file:///app/cache/pending.jpg')
})

it.each([
  ['permission denial', false],
  ['permission-check error', new Error('permission check failed')],
])('releases a pending file after %s', async (_case, permissionResult) => {
  if (permissionResult instanceof Error) {
    mockPermissionCheck.mockRejectedValueOnce(permissionResult)
  } else {
    mockPermissionCheck.mockResolvedValueOnce(permissionResult)
  }
  const { result } = renderHook(() => useCapturedPhotoWorkflow())

  act(() => {
    result.current.persistCapturedPhoto(
      frame('file:///app/cache/permission.jpg'),
      'capture',
    )
  })
  await act(async () => {
    await result.current.flushGallerySaves()
  })
  act(() => result.current.handleDiscardPhoto('photo-1'))

  expect(mockAssetCreate).not.toHaveBeenCalled()
  expect(mockDelete).toHaveBeenCalledWith('file:///app/cache/permission.jpg')
})

it('releases a pending file when the gallery save fails', async () => {
  mockAssetCreate.mockRejectedValueOnce(new Error('save failed'))
  const { result } = renderHook(() => useCapturedPhotoWorkflow())

  act(() => {
    result.current.persistCapturedPhoto(
      frame('file:///app/cache/error.jpg'),
      'capture',
    )
  })
  await act(async () => {
    await result.current.flushGallerySaves()
  })
  act(() => result.current.handleDiscardPhoto('photo-1'))

  expect(mockDelete).toHaveBeenCalledWith('file:///app/cache/error.jpg')
})
