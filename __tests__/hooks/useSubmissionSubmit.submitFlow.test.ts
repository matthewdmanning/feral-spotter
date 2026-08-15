import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useSubmissionSubmit } from '@/src/hooks/useSubmissionSubmit'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { CONSENT_VERSION, useConsentStore } from '@/src/hooks/useConsentStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { useUIStore } from '@/src/hooks/useUIStore'
import {
  finalizeSubmissionPhotoMetadata,
  hashUid,
  uploadSubmissionMetadata,
} from '@/src/lib/upload/firebaseUpload'
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

jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  uploadSubmissionMetadata: jest.fn(),
  finalizeSubmissionPhotoMetadata: jest.fn(() => Promise.resolve()),
  hashUid: jest.fn(() => Promise.resolve('hashed-uid-owner')),
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-owner' } }),
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

// #265: zero cats is now a hard block, so every test exercising a
// successful submit needs at least one — this is the default one.
function defaultCat() {
  return {
    local_id: 'cat-default',
    age: 'adult',
    ear_tipped: 'unsure',
    owned_domesticated: 'unsure',
    pattern: 'solid',
    hair_length: 'short',
    color: 'black',
    sex: 'unknown',
    health_label: 'unknown',
    photo_local_ids: ['photo-1'],
    photos_reviewed: true,
  }
}

describe('useSubmissionSubmit submit flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.clear()
    useSubmissionStore.setState({
      cats: [defaultCat()],
      submission: { location_type: 'device', time_type: 'device' },
      currentStep: 'create',
    })
    usePhotoStore.setState({ photos: [], submissionId: 'sub-cloud-1' })
    useBoundingBoxStore.setState({ boxes: {}, lastBoxes: {}, absences: {} })
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

  it('only submits photos with both a cloud path and url, among uploaded photos', async () => {
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
      ],
    })
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        photo_paths: ['gs://bucket/uploaded.jpg'],
      }),
      'uid-owner',
      'sub-cloud-1',
    )
    // The background Live-fix reacquire (src/lib/location.ts) would otherwise
    // keep re-watching every 5 minutes for the rest of the app's lifetime.
    expect(mockStopLocationCapture).toHaveBeenCalled()
  })

  // #264 amendment to ADR-0002/ADR-0003: each photo's own Storage object must
  // carry location/time/upload-time/hashed-uid, not just metadata.json.
  it('finalizes each uploaded photo with the hashed uid, submission location, and captured_at', async () => {
    useSubmissionStore.setState({
      submission: {
        location_type: 'pin',
        time_type: 'device',
        latitude: 12.5,
        longitude: -45.5,
        captured_at: '2026-08-01T10:00:00.000Z',
      },
    })
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
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(finalizeSubmissionPhotoMetadata).toHaveBeenCalledWith(
      'gs://bucket/uploaded.jpg',
      'hashed-uid-owner',
      '2026-08-01T10:00:00.000Z',
      12.5,
      -45.5,
    )
    // Reuses the same hashUid() the object path itself is built from
    // (ADR-0005) — not a separately re-derivable SHA-256(uid).
    expect(hashUid).toHaveBeenCalledWith('uid-owner')
  })

  it("prefers a photo's own captured_at over the submission-wide fallback", async () => {
    useSubmissionStore.setState({
      submission: {
        location_type: 'device',
        time_type: 'device',
        captured_at: '2026-08-01T10:00:00.000Z',
      },
    })
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-uploaded',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/uploaded.jpg',
          cloud_storage_url: 'https://cdn/uploaded.jpg',
          captured_at: '2026-08-01T09:45:00.000Z',
        }),
      ],
    })
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(finalizeSubmissionPhotoMetadata).toHaveBeenCalledWith(
      'gs://bucket/uploaded.jpg',
      'hashed-uid-owner',
      '2026-08-01T09:45:00.000Z',
      undefined,
      undefined,
    )
  })

  // ADR-0003's multi-select rule folds a Library pick batch's *earliest*
  // EXIF time into submission.captured_at — correct at submission
  // granularity, wrong if stamped onto every photo (every photo but the
  // earliest gets someone else's capture time). Each photo's own EXIF must
  // win instead.
  it("prefers a Library pick's own parsed EXIF time over the submission-wide earliest", async () => {
    useSubmissionStore.setState({
      submission: {
        location_type: 'pin',
        time_type: 'device',
        captured_at: '2026-08-01T09:00:00.000Z',
      },
    })
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-later',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/later.jpg',
          cloud_storage_url: 'https://cdn/later.jpg',
          exif: { timestamp: '2026:08:01 09:30:00' },
        }),
      ],
    })
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(finalizeSubmissionPhotoMetadata).toHaveBeenCalledWith(
      'gs://bucket/later.jpg',
      'hashed-uid-owner',
      // EXIF DateTime has no timezone — parseExifDateTime treats it as
      // local time, same convention as libraryPickTime.test.ts, so the
      // expectation must be built the same way rather than a hardcoded UTC
      // literal (which only matches on a UTC test runner).
      new Date('2026-08-01T09:30:00').toISOString(),
      undefined,
      undefined,
    )
  })

  it('still uploads metadata.json and does not fail the submission when finalizing one photo rejects', async () => {
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-a',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/a.jpg',
          cloud_storage_url: 'https://cdn/a.jpg',
        }),
        photo({
          local_id: 'photo-b',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/b.jpg',
          cloud_storage_url: 'https://cdn/b.jpg',
        }),
      ],
    })
    ;(finalizeSubmissionPhotoMetadata as jest.Mock)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(undefined)
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) => {
        buttons?.find((b) => b.text === 'Submit')?.onPress?.()
      })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).toHaveBeenCalled()
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Submission Failed',
      expect.anything(),
    )
  })

  it("includes each cat's box geometry from useBoundingBoxStore in the uploaded payload", async () => {
    useSubmissionStore.setState({
      cats: [
        {
          local_id: 'cat-1',
          age: 'adult',
          ear_tipped: 'unsure',
          owned_domesticated: 'unsure',
          pattern: 'solid',
          hair_length: 'short',
          color: 'black',
          sex: 'unknown',
          health_label: 'unknown',
          photo_local_ids: ['photo-uploaded'],
          photos_reviewed: true,
        },
      ],
    })
    useBoundingBoxStore.getState().addBox('cat-1', 'photo-uploaded', {
      lowerLeftX: 0.1,
      lowerLeftY: 0.2,
      upperRightX: 0.8,
      upperRightY: 0.9,
    })
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
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        cats: [
          expect.objectContaining({
            local_id: 'cat-1',
            boxes: [
              {
                photo_local_id: 'photo-uploaded',
                cloud_storage_path: 'gs://bucket/uploaded.jpg',
                lowerLeftX: 0.1,
                lowerLeftY: 0.2,
                upperRightX: 0.8,
                upperRightY: 0.9,
              },
            ],
          }),
        ],
      }),
      'uid-owner',
      'sub-cloud-1',
    )
  })

  // P0 (map #31): a submission that "succeeds" while silently missing a
  // still-uploading photo must not happen — block instead of filtering it out.
  it('blocks submit and shows an error when a photo is still uploading', async () => {
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-uploaded',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/uploaded.jpg',
          cloud_storage_url: 'https://cdn/uploaded.jpg',
        }),
        photo({ local_id: 'photo-not-uploaded', uploaded: false }),
      ],
    })
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
  })

  // #265: zero cats is a hard block.
  it('blocks submit and shows an error when there are no cats', async () => {
    useSubmissionStore.setState({ cats: [] })
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
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
  })

  // #265: zero photos is a hard block.
  it('blocks submit and shows an error when there are no photos', async () => {
    usePhotoStore.setState({ photos: [] })
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
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
    ;(uploadSubmissionMetadata as jest.Mock).mockResolvedValue(undefined)
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Submit')?.onPress?.()
    })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
    })

    expect(uploadSubmissionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ photo_paths: ['gs://bucket/uploaded.jpg'] }),
      'uid-owner',
      'sub-cloud-1',
    )
  })
})
