import * as ui from '@/src/shared/hooks/useUIStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'

import { useSubmissionSubmit } from '@/src/features/draft-submission/hooks/useSubmissionSubmit'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  finalizeSubmissionPhotoMetadata,
  uploadSubmissionMetadata,
} from '@/src/features/draft-submission/lib/upload/firebaseUpload'
import { observedCat } from '@/src/test-utils/catFixtures'
import { setConsent } from '@/src/test-utils/consent'
import { isDraftBusy } from '@/src/features/draft-submission/lib/draft'
import { pressDialogButton } from '@/src/test-utils/dialog'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
}))

jest.mock('posthog-react-native', () => ({
  usePostHog: () => null,
}))

jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  uploadSubmissionMetadata: jest.fn(),
  finalizeSubmissionPhotoMetadata: jest.fn(() => Promise.resolve()),
}))

const mockStopLocationCapture = jest.fn()
jest.mock('@/src/core/location/liveFix', () => ({
  stopLocationCapture: () => mockStopLocationCapture(),
}))

const photo = submissionPhoto

// #265: zero cats is now a hard block, so every test exercising a
// successful submit needs at least one — this is the default one.
const defaultCat = () =>
  observedCat({
    local_id: 'cat-default',
    photo_local_ids: ['photo-1'],
    photos_reviewed: true,
  })

describe('useSubmissionSubmit submit flow', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      user: { uid: 'uid-owner' } as never,
      isReady: true,
    })
    jest.restoreAllMocks()
    jest.clearAllMocks()
    await AsyncStorage.clear()
    useSubmissionStore.setState({
      cats: [defaultCat()],
      submission: { location_type: 'device', time_type: 'device' },
    })
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    usePhotoStore.setState({ submissionId: 'sub-cloud-1' })
    useBoundingBoxStore.setState(useBoundingBoxStore.getInitialState(), true)
    useUIStore.setState(useUIStore.getInitialState(), true)
    setConsent(true)
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
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(uploadSubmissionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        photo_paths: ['gs://bucket/uploaded.jpg'],
      }),
      'uid-owner',
      'sub-cloud-1',
    )
    // The background Live-fix reacquire (src/core/location/liveFix.ts) would otherwise
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
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(finalizeSubmissionPhotoMetadata).toHaveBeenCalledWith(
      'gs://bucket/uploaded.jpg',
      'uid-owner',
      '2026-08-01T10:00:00.000Z',
      12.5,
      -45.5,
    )
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
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(finalizeSubmissionPhotoMetadata).toHaveBeenCalledWith(
      'gs://bucket/uploaded.jpg',
      'uid-owner',
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
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(finalizeSubmissionPhotoMetadata).toHaveBeenCalledWith(
      'gs://bucket/later.jpg',
      'uid-owner',
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
    jest
      .mocked(finalizeSubmissionPhotoMetadata)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(undefined)
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(uploadSubmissionMetadata).toHaveBeenCalled()
    expect(useUIStore.getState().dialog?.title).not.toBe('Sighting Failed')
    expect(isDraftBusy()).toBe(false)
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
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

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

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
    expect(useUIStore.getState().dialog).toEqual(
      expect.objectContaining({
        title: 'Sighting Incomplete',
        message: 'At least one cat observation is required.',
      }),
    )
    expect(useSubmissionStore.getState().cats).toEqual([])
    expect(usePhotoStore.getState().photos).toHaveLength(1)
    expect(result.current.isSubmitting).toBe(false)
    expect(isDraftBusy()).toBe(false)
  })

  // #265: zero photos is a hard block.
  it('blocks submit and shows an error when there are no photos', async () => {
    usePhotoStore.setState({ photos: [] })

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
    expect(useUIStore.getState().dialog).toEqual(
      expect.objectContaining({
        title: 'Sighting Incomplete',
        message: 'At least one photo is required.',
      }),
    )
    expect(useSubmissionStore.getState().cats).toEqual([defaultCat()])
    expect(usePhotoStore.getState().photos).toEqual([])
    expect(result.current.isSubmitting).toBe(false)
    expect(isDraftBusy()).toBe(false)
  })

  it('still submits (photos/details are not privileged) when consent has not been accepted', async () => {
    setConsent(false)
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
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(uploadSubmissionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ photo_paths: ['gs://bucket/uploaded.jpg'] }),
      'uid-owner',
      'sub-cloud-1',
    )
  })

  // #377: both failure paths must name the next action and say the draft
  // survived, and they must read differently — a stalled upload needs a
  // better connection, a rejected send only needs a second attempt.
  it('tells the user the Submission is saved and how to retry when the upload stalls', async () => {
    usePhotoStore.setState({
      photos: [photo({ local_id: 'photo-stalled', uploaded: false })],
    })
    // Fake timers move the clock and the poll together, so the 30 s wait
    // times out without depending on which code reads Date.now() first.
    jest.useFakeTimers()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const errorSpy = jest.spyOn(ui, 'showError').mockImplementation(() => {})

    const { result } = await renderHook(() => useSubmissionSubmit())

    try {
      await act(async () => {
        result.current.handleDone()
        const submit = useUIStore
          .getState()
          .dialog?.buttons.find((b) => b.text === 'Submit')
        expect(submit?.onPress).toEqual(expect.any(Function))
        const sending = submit!.onPress!() as unknown as Promise<void>
        await jest.advanceTimersByTimeAsync(31_000)
        await sending
      })
    } finally {
      jest.useRealTimers()
    }

    expect(errorSpy).toHaveBeenCalledWith(
      'Photos Still Uploading',
      expect.stringContaining('saved on this device'),
    )
    expect(errorSpy).toHaveBeenCalledWith(
      'Photos Still Uploading',
      expect.stringContaining('Check your connection'),
    )
    // Nothing was sent, and the cats survive for the next attempt.
    expect(uploadSubmissionMetadata).not.toHaveBeenCalled()
    expect(useSubmissionStore.getState().cats).toHaveLength(1)
  })

  it('tells the user the Submission is saved and how to retry when the send fails, without the raw error', async () => {
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
    jest
      .mocked(uploadSubmissionMetadata)
      .mockRejectedValue(new Error('PERMISSION_DENIED: storage/unauthorized'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const errorSpy = jest.spyOn(ui, 'showError').mockImplementation(() => {})

    const { result } = await renderHook(() => useSubmissionSubmit())

    await act(() => result.current.handleDone())
    await pressDialogButton('Submit')

    expect(errorSpy).toHaveBeenCalledWith(
      'Sighting Failed',
      expect.stringContaining('saved on this device'),
    )
    expect(errorSpy).not.toHaveBeenCalledWith(
      'Sighting Failed',
      expect.stringContaining('PERMISSION_DENIED'),
    )
    expect(useSubmissionStore.getState().cats).toHaveLength(1)
  })
})
