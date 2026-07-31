import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useSubmissionSubmit } from '@/src/hooks/useSubmissionSubmit'
import { CONSENT_VERSION, useConsentStore } from '@/src/hooks/useConsentStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { useUIStore } from '@/src/hooks/useUIStore'
import { submitObservation } from '@/src/utils/api'
import type { SubmissionPhoto } from '@/src/types'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'cat-1'),
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('posthog-react-native', () => ({
  usePostHog: () => null,
}))

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

jest.mock('@/src/utils/api', () => ({
  submitObservation: jest.fn(),
}))

const mockStopLocationCapture = jest.fn()
jest.mock('@/src/lib/location', () => ({
  stopLocationCapture: () => mockStopLocationCapture(),
}))

function photo(overrides: Partial<SubmissionPhoto>): SubmissionPhoto {
  return {
    local_id: 'photo-1',
    uri: 'file:///photo-1.jpg',
    uploaded: false,
    upload_progress: 0,
    width: 100,
    height: 100,
    ...overrides,
  }
}

describe('useSubmissionSubmit submit flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.clear()
    useSubmissionStore.setState({
      cats: [],
      submission: { location_type: 'device', time_type: 'device' },
      history: [],
      currentStep: 'create',
    })
    usePhotoStore.setState({ photos: [] })
    useUIStore.setState({
      isOnline: true,
      sessionPhotos: [],
      isSubmitting: false,
    })
    useConsentStore.setState({
      accepted: true,
      acceptedVersion: CONSENT_VERSION,
    })
  })

  it('only submits photos that are uploaded with both a cloud path and url', async () => {
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-uploaded',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/uploaded.jpg',
          cloud_storage_url: 'https://cdn/uploaded.jpg',
        }),
        // uploaded=true but missing cloud_storage_path — e.g. a race between
        // the upload flag and the cache write completing. Must be excluded,
        // not passed through with an asserted-away undefined path.
        photo({
          local_id: 'photo-missing-path',
          uploaded: true,
          cloud_storage_url: 'https://cdn/missing-path.jpg',
        }),
        // not uploaded at all
        photo({
          local_id: 'photo-not-uploaded',
          uploaded: false,
          cloud_storage_path: 'gs://bucket/not-uploaded.jpg',
          cloud_storage_url: 'https://cdn/not-uploaded.jpg',
        }),
      ],
    })
    ;(submitObservation as jest.Mock).mockResolvedValue({
      status: 'success',
      id: 'submission-1',
    })
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(submitObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        photo_paths: ['gs://bucket/uploaded.jpg'],
      }),
    )
    expect(useSubmissionStore.getState().history).toEqual([
      expect.objectContaining({
        id: 'submission-1',
        photo_urls: ['https://cdn/uploaded.jpg'],
      }),
    ])
    // The background Live-fix reacquire (src/lib/location.ts) would otherwise
    // keep re-watching every 5 minutes for the rest of the app's lifetime.
    expect(mockStopLocationCapture).toHaveBeenCalled()
  })

  it('still submits (photos/details are not privileged) when consent has not been accepted', async () => {
    useConsentStore.setState({ accepted: false, acceptedVersion: null })
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-uploaded',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/uploaded.jpg',
          cloud_storage_url: 'https://cdn/uploaded.jpg',
        }),
      ],
    })
    ;(submitObservation as jest.Mock).mockResolvedValue({
      status: 'success',
      id: 'submission-1',
    })
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(submitObservation).toHaveBeenCalledWith(
      expect.objectContaining({ photo_paths: ['gs://bucket/uploaded.jpg'] }),
    )
  })
})
