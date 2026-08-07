import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useSubmissionSubmit } from '../useSubmissionSubmit'
import { useSubmissionStore } from '../useSubmissionStore'
import { usePhotoStore } from '../usePhotoStore'

/**
 * Regression check for #189 (Reset button reported not to clear the
 * submission live on-device): drives the real handleReset callback
 * against the real, persisted useSubmissionStore/usePhotoStore — not
 * mocks of them — since the reported symptom is that cleared state
 * doesn't stick, which a mocked store could hide.
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
  submitObservation: jest.fn(),
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
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
})

describe('useSubmissionSubmit — handleReset (#189)', () => {
  beforeEach(() => {
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.setState({ photos: [], source: null })
    useSubmissionStore.getState().addCat(cat('cat-1'))
    usePhotoStore.getState().addPhoto(photo('photo-1'))
  })

  it('clears cats and photos from the real stores on Reset confirm', async () => {
    expect(useSubmissionStore.getState().cats).toHaveLength(1)
    expect(usePhotoStore.getState().photos).toHaveLength(1)

    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) => {
        const resetButton = buttons?.find((b) => b.text === 'Reset')
        void resetButton?.onPress?.()
      })

    const { result } = renderHook(() => useSubmissionSubmit())

    await act(async () => {
      result.current.handleReset()
      // handleReset's onPress is async (awaits cache lookups before
      // clearing) — flush those microtasks before asserting.
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useSubmissionStore.getState().cats).toEqual([])
    expect(usePhotoStore.getState().photos).toEqual([])

    alertSpy.mockRestore()
  })
})
