import * as ui from '@/src/shared/hooks/useUIStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import {
  getAuth,
  reload,
  sendEmailVerification,
} from '@react-native-firebase/auth'

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
import { submissionCopy } from '@/src/shared/config/text'

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
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

  // #453: a replace swapped only the top screen, leaving the Camera under the
  // new Home, so Back re-opened the finished flow.
  it('pops back to the existing Home after a send instead of replacing the top screen', async () => {
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

    expect(router.dismissTo).toHaveBeenCalledWith('/')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('lets an unverified user request a link and retry the same draft after verifying', async () => {
    usePhotoStore.setState({
      photos: [
        photo({
          uploaded: true,
          cloud_storage_path: 'gs://bucket/uploaded.jpg',
          cloud_storage_url: 'https://cdn/uploaded.jpg',
        }),
      ],
    })
    const user = {
      uid: 'uid-owner',
      email: 'me@example.test',
      emailVerified: false,
    }
    const auth = { currentUser: user } as ReturnType<typeof getAuth>
    const authMock = jest.mocked(getAuth).mockReturnValue(auth)
    const reloadMock = jest.mocked(reload)
    reloadMock
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        user.emailVerified = true
      })
    jest.mocked(sendEmailVerification).mockResolvedValueOnce(undefined)
    jest.mocked(uploadSubmissionMetadata).mockResolvedValue(undefined)
    try {
      const { result } = await renderHook(() => useSubmissionSubmit())
      await act(() => result.current.handleDone())
      await pressDialogButton('Submit')
      await pressDialogButton('Send verification link')
      expect(sendEmailVerification).toHaveBeenCalledWith(user)
      expect(uploadSubmissionMetadata).not.toHaveBeenCalled()

      await pressDialogButton('OK')
      await act(() => result.current.handleDone())
      await pressDialogButton('Submit')
      expect(uploadSubmissionMetadata).toHaveBeenCalledTimes(1)
    } finally {
      authMock.mockReturnValue({ currentUser: null } as ReturnType<
        typeof getAuth
      >)
    }
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

  // #264 amendment to ADR-0002: each photo's own Storage object carries
  // location/upload-time/uid and, for a camera capture, its camera settings.
  // Time is not patched there (ADR-0003, 2026-11-24): metadata.json holds it.
  it('finalizes each uploaded photo with the uid, submission location and camera config', async () => {
    const cameraConfig = {
      backend: 'camerax',
      capture_mode: 'maximize_quality',
      field_condition: 'low_light',
    }
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
          camera_config: cameraConfig,
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
      12.5,
      -45.5,
      cameraConfig,
    )
  })

  // LOGIC-4: a failed Storage-metadata patch must not lose the photo's time.
  it("keeps each photo's time in metadata.json when finalizing one photo rejects", async () => {
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-a',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/a.jpg',
          cloud_storage_url: 'https://cdn/a.jpg',
          captured_at: '2026-08-01T09:45:00.000Z',
        }),
        photo({
          local_id: 'photo-b',
          uploaded: true,
          cloud_storage_path: 'gs://bucket/b.jpg',
          cloud_storage_url: 'https://cdn/b.jpg',
          captured_at: '2026-08-01T09:46:00.000Z',
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

    expect(
      jest.mocked(uploadSubmissionMetadata).mock.calls[0][0].photo_times,
    ).toEqual([
      {
        path: 'gs://bucket/a.jpg',
        time_source: 'capture',
        time: '2026-08-01T09:45:00.000Z',
      },
      {
        path: 'gs://bucket/b.jpg',
        time_source: 'capture',
        time: '2026-08-01T09:46:00.000Z',
      },
    ])
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

  // LOGIC-5: a refused upload grant used to read as a generic stall, so
  // nothing said that waiting, or verifying an email, was the cure.
  it('names the refusal reason when the server refused the upload grant', async () => {
    usePhotoStore.setState({
      photos: [
        photo({
          local_id: 'photo-refused',
          uploaded: false,
          upload_refusal: 'too_many_open_submissions',
        }),
      ],
    })
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
        const sending = submit!.onPress!() as unknown as Promise<void>
        await jest.advanceTimersByTimeAsync(31_000)
        await sending
      })
    } finally {
      jest.useRealTimers()
    }

    expect(errorSpy).toHaveBeenCalledWith(
      submissionCopy.alerts.uploadRefusedTitle,
      submissionCopy.alerts.uploadRefused.too_many_open_submissions,
    )
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
