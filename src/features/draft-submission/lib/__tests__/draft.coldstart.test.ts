import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@/src/core/location/liveFix', () => ({ stopLocationCapture: jest.fn() }))
jest.mock('@/src/features/draft-submission/lib/upload/firebaseUpload', () => ({
  deleteSubmissionUploads: jest.fn(),
}))
jest.mock('@/src/features/auth/lib', () => ({
  authProvider: { getCurrentUser: () => null },
}))

it('defers draft I/O until startup and reads the saved photo pool only once', async () => {
  const now = Date.now()
  await AsyncStorage.setItem(
    'photo-store',
    JSON.stringify({
      version: 0,
      state: {
        photos: [
          {
            local_id: 'saved-photo',
            uri: 'file:///saved.jpg',
            width: 100,
            height: 100,
            uploaded: false,
            upload_progress: 0,
          },
        ],
        source: 'camera',
        submissionId: 'saved-submission',
        updated_at: now,
      },
    }),
  )
  const reads = jest.spyOn(AsyncStorage, 'getItem')
  try {
    const { discardUnsurvivingDraft } =
      jest.requireActual<typeof import('@/src/features/draft-submission/lib/draft')>('../draft')
    const { usePhotoStore } = jest.requireActual<
      typeof import('@/src/features/draft-submission/hooks/usePhotoStore')
    >('@/src/features/draft-submission/hooks/usePhotoStore')
    expect(reads).not.toHaveBeenCalledWith('photo-store')
    expect(usePhotoStore.getState().photos).toEqual([])

    const captureReady = jest.fn(() => {
      expect(usePhotoStore.getState().photos[0].local_id).toBe('saved-photo')
    })
    await discardUnsurvivingDraft(now, captureReady)
    expect(captureReady).toHaveBeenCalledTimes(1)
    expect(
      reads.mock.calls.filter(([key]) => key === 'photo-store'),
    ).toHaveLength(1)
  } finally {
    reads.mockRestore()
  }
})
