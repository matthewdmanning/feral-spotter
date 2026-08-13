import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { updateSubmissionCache } from '@/src/lib/cache/submissionCache'
import { submitObservation } from '@/src/utils/api'
import { useSubmissionSubmit } from '../useSubmissionSubmit'
import { useSubmissionStore } from '../useSubmissionStore'
import { usePhotoStore } from '../usePhotoStore'

/**
 * Regression check for #228: updateSubmissionCache replaces `metadata`
 * wholesale (no deep merge — see submissionCache.ts), so a submit that
 * only patched status/cats/photo_links silently dropped manual_time set
 * after the cache's initial creation (the EXIF-less Library-pick path,
 * ADR 0003 / #224).
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

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
  deleteSubmissionCache: jest.fn().mockResolvedValue(undefined),
  updateSubmissionCache: jest.fn().mockResolvedValue(undefined),
  getSubmissionCache: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/src/lib/location', () => ({
  stopLocationCapture: jest.fn(),
}))

jest.mock('@/src/lib/analytics/analytics', () => ({
  fireAnalyticsEvent: jest.fn(),
  EVENTS: {
    SUBMISSION_SENDING: 'x',
    SUBMISSION_SUBMITTED: 'y',
    SUBMISSION_FAILED: 'z',
  },
}))

jest.mock('@/src/utils/api', () => ({
  submitObservation: jest
    .fn()
    .mockResolvedValue({ status: 'success', id: 'r1' }),
}))

const cat = (id: string) => ({
  local_id: id,
  age: 'adult' as const,
  ear_tipped: 'unsure' as const,
  owned_domesticated: 'unsure' as const,
  pattern: 'solid' as const,
  hair_length: 'short' as const,
  color: 'black' as const,
  sex: 'unknown' as const,
  health_label: 'unknown' as const,
  photo_local_ids: ['p1'],
  photos_reviewed: true,
})

const photo = (id: string) => ({
  local_id: id,
  uri: `file://${id}.jpg`,
  uploaded: true,
  upload_progress: 100,
  width: 100,
  height: 100,
})

describe('useSubmissionSubmit — handleDone cache sync (#228)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(submitObservation).mockResolvedValue({
      status: 'success',
      id: 'r1',
    })
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.setState({ photos: [], source: null })
    useSubmissionStore.getState().addCat(cat('cat-1'))
    usePhotoStore.getState().addPhoto(photo('photo-1'))
  })

  it('includes the current manual_time/time_type in the cache update on submit', async () => {
    useSubmissionStore.getState().setTimeType('manual')
    useSubmissionStore.getState().setManualTime('2026-08-01T12:00:00.000Z')

    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) => {
        const submitButton = buttons?.find((b) => b.text === 'Submit')
        void submitButton?.onPress?.()
      })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleDone()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateSubmissionCache).toHaveBeenCalledWith(
      'cache-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          time_method: 'manual',
          manual_time: '2026-08-01T12:00:00.000Z',
        }),
      }),
    )

    alertSpy.mockRestore()
  })
})
