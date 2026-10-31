import { act, renderHook, waitFor } from '@testing-library/react-native'
import { File, Paths } from 'expo-file-system'
import { Asset } from 'expo-media-library'
import { usePhotoStore } from '../usePhotoStore'
import { useCapturedPhotoWorkflow } from '../useCapturedPhotoWorkflow'
import { useDraftStartupStore } from '../useDraftStartupStore'

// The supplied mock helper is outside the package's public exports map.
const { __resetMockFileSystem } = jest.requireActual(
  require
    .resolve('expo-file-system/package.json')
    .replace('package.json', 'mocks/FileSystem.ts'),
)

let mockId = 0
jest.mock('expo-crypto', () => ({
  randomUUID: () => `photo-${++mockId}`,
}))

const mockAssetCreate = jest.fn()
const mockPermissionCheck = jest.fn(async () => true)
// The gallery save is external: stub the public Asset.create the hook calls.
// (A native-module mock broke when SDK 58 moved expo-media-library's native
// binding, and the hook's contract is this one call, not the binding.) Set
// in beforeEach, because afterEach's restoreAllMocks removes the spy.
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
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('@/src/components/atoms/CameraThumb', () => ({
  CameraThumb: 'CameraThumb',
}))
jest.mock('@/src/lib/upload/uploadNewPhoto', () => ({
  uploadNewPhoto: jest.fn(),
}))

jest.mock('@/src/hooks', () => ({
  usePhotoStore: jest.requireActual('../usePhotoStore').usePhotoStore,
}))
jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (select: (state: object) => unknown) =>
    select({ settings: { keep_photos_on_device: true } }),
}))

const frame = (uri: string) => ({ uri, width: 100, height: 100 })

beforeEach(async () => {
  jest
    .spyOn(Asset, 'create')
    .mockImplementation((...args) => mockAssetCreate(...args))
  await usePhotoStore.persist.rehydrate()
  usePhotoStore.setState({
    photos: [],
    source: null,
    submissionId: 'test-submission',
  })
  useDraftStartupStore.setState({ phase: 'ready', task: null })
  __resetMockFileSystem()
  mockAssetCreate.mockReset()
  mockAssetCreate.mockResolvedValue(undefined)
  mockPermissionCheck.mockReset()
  mockPermissionCheck.mockResolvedValue(true)
  mockId = 0
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('keeps preview active during restoration and enables capture before cleanup finishes', () => {
  useDraftStartupStore.setState({ phase: 'restoring' })
  const { result } = renderHook(() => useCapturedPhotoWorkflow())
  expect(result.current.isActive).toBe(true)
  expect(result.current.canCapture).toBe(false)

  act(() => {
    useDraftStartupStore.setState({ phase: 'cleaning' })
  })
  expect(result.current.isActive).toBe(true)
  expect(result.current.canCapture).toBe(true)
  act(() => {
    result.current.persistCapturedPhoto(
      frame('file:///tmp/field.jpg'),
      'capture',
    )
  })
  expect(usePhotoStore.getState().photos).toHaveLength(1)

  act(() => {
    useDraftStartupStore.setState({ phase: 'ready' })
  })
  expect(result.current.canCapture).toBe(true)

  act(() => {
    usePhotoStore.setState({ source: 'library' })
  })
  expect(result.current.canCapture).toBe(false)
  expect(() =>
    result.current.persistCapturedPhoto(
      frame('file:///tmp/blocked.jpg'),
      'capture',
    ),
  ).toThrow('Camera capture is not available')

  act(() => {
    usePhotoStore.setState({ source: null })
    useDraftStartupStore.setState({ phase: 'restoring' })
  })
  expect(result.current.canCapture).toBe(false)
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
  const file = new File(Paths.cache, 'pending.jpg')
  file.create()
  const { result } = renderHook(() => useCapturedPhotoWorkflow())

  act(() => {
    result.current.persistCapturedPhoto(frame(file.uri), 'capture')
  })
  const flush = result.current.flushGallerySaves()
  await waitFor(() => expect(mockAssetCreate).toHaveBeenCalledWith(file.uri))
  act(() => result.current.handleDiscardPhoto('photo-1'))
  expect(usePhotoStore.getState().photos).toEqual([])
  expect(file.exists).toBe(true)

  await act(async () => {
    resolveSave()
    await flush
  })
  expect(file.exists).toBe(false)
})

it.each([
  ['permission denial', false],
  ['permission-check error', new Error('permission check failed')],
])('releases a pending file after %s', async (_case, permissionResult) => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  if (permissionResult instanceof Error) {
    mockPermissionCheck.mockRejectedValueOnce(permissionResult)
  } else {
    mockPermissionCheck.mockResolvedValueOnce(permissionResult)
  }
  const file = new File(Paths.cache, 'permission.jpg')
  file.create()
  const { result } = renderHook(() => useCapturedPhotoWorkflow())

  act(() => {
    result.current.persistCapturedPhoto(frame(file.uri), 'capture')
  })
  await act(async () => {
    await result.current.flushGallerySaves()
  })
  act(() => result.current.handleDiscardPhoto('photo-1'))

  expect(mockAssetCreate).not.toHaveBeenCalled()
  if (permissionResult instanceof Error) {
    expect(errors).toHaveBeenCalledTimes(1)
    expect(errors).toHaveBeenCalledWith(
      '[useCapturedPhotoWorkflow] gallery permission:',
      permissionResult,
    )
  } else {
    expect(errors).not.toHaveBeenCalled()
  }
  expect(usePhotoStore.getState().photos).toEqual([])
  expect(file.exists).toBe(false)
})

it('releases a pending file when the gallery save fails', async () => {
  const saveError = new Error('save failed')
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  mockAssetCreate.mockRejectedValueOnce(saveError)
  const file = new File(Paths.cache, 'error.jpg')
  file.create()
  const { result } = renderHook(() => useCapturedPhotoWorkflow())

  act(() => {
    result.current.persistCapturedPhoto(frame(file.uri), 'capture')
  })
  await act(async () => {
    await result.current.flushGallerySaves()
  })
  act(() => result.current.handleDiscardPhoto('photo-1'))

  expect(mockAssetCreate).toHaveBeenCalledWith(file.uri)
  expect(errors).toHaveBeenCalledTimes(1)
  expect(errors).toHaveBeenCalledWith(
    '[useCapturedPhotoWorkflow] Asset.create:',
    saveError,
  )
  expect(usePhotoStore.getState().photos).toEqual([])
  expect(file.exists).toBe(false)
})
