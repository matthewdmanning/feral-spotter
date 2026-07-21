import { act, renderHook } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { usePhotoSession } from '@/src/hooks/usePhotoSession'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { useUIStore } from '@/src/hooks/useUIStore'
import { getPermissionState, requestPermission } from '@/src/lib/permissions'

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

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }))
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'photo-1') }))

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(),
}))

jest.mock('@/src/lib/permissions', () => ({
  getPermissionState: jest.fn(),
  requestPermission: jest.fn(),
}))

describe('usePhotoSession library permission gate', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.clear()
    useSubmissionStore.setState({ currentStep: 'cats' })
    usePhotoStore.setState({ photos: [] })
    useUIStore.setState({ sessionPhotos: [] })
    useConsentStore.setState({
      primers: {
        location: { status: 'pending', decidedAt: null },
        camera: { status: 'pending', decidedAt: null },
        photo_library: { status: 'pending', decidedAt: null },
      },
    })
  })

  it('launches the picker directly when permission is already granted', async () => {
    ;(getPermissionState as jest.Mock).mockResolvedValue('granted')
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
    })

    const { result } = renderHook(() => usePhotoSession())
    await act(async () => {
      await result.current.pickFromLibrary()
    })

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1)
    expect(result.current.libraryGate.visible).toBe(false)
  })

  it('shows the re-prime gate instead of the picker when permission is not granted', async () => {
    ;(getPermissionState as jest.Mock).mockResolvedValue('ask')

    const { result } = renderHook(() => usePhotoSession())
    await act(async () => {
      await result.current.pickFromLibrary()
    })

    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled()
    expect(result.current.libraryGate.visible).toBe(true)
    expect(result.current.libraryGate.blocked).toBe(false)
  })

  it('marks the gate blocked when the OS can no longer be asked', async () => {
    ;(getPermissionState as jest.Mock).mockResolvedValue('blocked')

    const { result } = renderHook(() => usePhotoSession())
    await act(async () => {
      await result.current.pickFromLibrary()
    })

    expect(result.current.libraryGate.blocked).toBe(true)
  })

  it('affirming the gate requests permission, records it, and launches the picker on success', async () => {
    ;(getPermissionState as jest.Mock).mockResolvedValue('ask')
    ;(requestPermission as jest.Mock).mockResolvedValue(true)
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
    })

    const { result } = renderHook(() => usePhotoSession())
    await act(async () => {
      await result.current.pickFromLibrary()
    })
    await act(async () => {
      result.current.libraryGate.onAffirm()
    })

    expect(requestPermission).toHaveBeenCalledWith('photo_library')
    expect(useConsentStore.getState().primers.photo_library.status).toBe(
      'granted',
    )
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1)
    expect(result.current.libraryGate.visible).toBe(false)
  })

  it('deferring the gate records deferred and does not launch the picker', async () => {
    ;(getPermissionState as jest.Mock).mockResolvedValue('ask')

    const { result } = renderHook(() => usePhotoSession())
    await act(async () => {
      await result.current.pickFromLibrary()
    })
    act(() => {
      result.current.libraryGate.onDefer()
    })

    expect(useConsentStore.getState().primers.photo_library.status).toBe(
      'deferred',
    )
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled()
    expect(result.current.libraryGate.visible).toBe(false)
  })
})
