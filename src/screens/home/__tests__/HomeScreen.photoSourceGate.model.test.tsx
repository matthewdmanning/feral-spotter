import { act, render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import HomeScreen from '../index'

/**
 * Model of the photo-source-exclusivity gate (ADR 0002's 2026-07-31
 * amendment): "a draft is single-source by construction". Kept as its own
 * machine, separate from HomeScreen.gate.model.test.tsx's auth/consent
 * gate — the two are orthogonal and cross-producting them would explode the
 * state count for no benefit.
 *
 * Real store actions drive pool changes so the rendered gate also checks
 * the store subscription and source-clearing behavior after removal/reset.
 */
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ isReady: true, isAuthenticated: true }),
}))
jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: () => true,
}))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))
jest.mock('@/src/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))
const photo = {
  local_id: 'photo-1',
  uri: 'file:///picked-photo.jpg',
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
}

const gateMachine = createMachine({
  id: 'photoSourceGate',
  initial: 'emptyPool',
  states: {
    emptyPool: {
      on: {
        CAMERA_PICK: 'cameraDraft',
        LIBRARY_PICK: 'libraryDraft',
      },
    },
    cameraDraft: {
      on: { REMOVE_LAST: 'emptyPool', CLEAR_PHOTO_POOL: 'emptyPool' },
    },
    libraryDraft: {
      on: { REMOVE_LAST: 'emptyPool', CLEAR_PHOTO_POOL: 'emptyPool' },
    },
  },
})

describe('HomeScreen photo-source-exclusivity gate — model-based test', () => {
  let getByLabelText: ReturnType<typeof render>['getByLabelText']
  let queryByText: ReturnType<typeof render>['queryByText']

  beforeEach(async () => {
    jest.clearAllMocks()
    await usePhotoStore.persist.rehydrate()
    usePhotoStore.setState({ photos: [], source: null, submissionId: null })
    const result = render(<HomeScreen />)
    getByLabelText = result.getByLabelText
    queryByText = result.queryByText
  })

  const model = createTestModel(gateMachine)

  // #375: a disabled entrypoint must also say why. `reason` is the source the
  // pool is pinned to, or null when both entrypoints are live and no reason
  // line may appear.
  const expectDisabled = async (
    camera: boolean,
    library: boolean,
    reason: 'camera' | 'library' | null,
  ) => {
    await waitFor(() => {
      expect(
        getByLabelText('Take Photos').props.accessibilityState.disabled,
      ).toBe(camera)
      expect(
        getByLabelText('Upload Photos').props.accessibilityState.disabled,
      ).toBe(library)
      expect(queryByText(/uses Take Photos/)).toEqual(
        reason === 'camera' ? expect.anything() : null,
      )
      expect(queryByText(/uses Upload Photos/)).toEqual(
        reason === 'library' ? expect.anything() : null,
      )
    })
  }

  const testParams = {
    states: {
      emptyPool: () => expectDisabled(false, false, null),
      cameraDraft: () => expectDisabled(false, true, 'camera'),
      libraryDraft: () => expectDisabled(true, false, 'library'),
    },
    events: {
      CAMERA_PICK: async () => {
        await act(async () => {
          usePhotoStore.getState().addPhoto(photo)
        })
      },
      LIBRARY_PICK: async () => {
        await act(async () => {
          usePhotoStore.getState().addPhotos([photo])
        })
      },
      REMOVE_LAST: async () => {
        await act(async () => {
          usePhotoStore.getState().removePhoto(photo.local_id)
        })
      },
      CLEAR_PHOTO_POOL: async () => {
        await act(async () => {
          usePhotoStore.getState().clearPhotos()
        })
      },
    },
  }

  const journeys = [
    {
      name: 'camera pick disables the library entrypoint',
      events: [{ type: 'CAMERA_PICK' }],
    },
    {
      name: 'library pick disables the camera entrypoint',
      events: [{ type: 'LIBRARY_PICK' }],
    },
    {
      name: 'removing the last camera photo re-enables both entrypoints',
      events: [{ type: 'CAMERA_PICK' }, { type: 'REMOVE_LAST' }],
    },
    {
      name: 'clearing the library photo pool re-enables both entrypoints',
      events: [{ type: 'LIBRARY_PICK' }, { type: 'CLEAR_PHOTO_POOL' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
