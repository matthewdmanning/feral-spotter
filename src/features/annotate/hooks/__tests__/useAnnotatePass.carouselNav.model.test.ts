import { act, renderHook } from '@testing-library/react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { router } from 'expo-router'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useAnnotatePass } from '../useAnnotatePass'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'

/**
 * Drives carousel position and the final-photo completion against the real
 * active-cat and photo stores. Confirm and Not in Photo advance until the
 * last photo, where they complete the pass without incrementing the index.
 */
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}))

const THREE_PHOTOS = [
  {
    local_id: 'photo-1',
    uri: 'a',
    uploaded: false,
    upload_progress: 0,
    width: 1,
    height: 1,
  },
  {
    local_id: 'photo-2',
    uri: 'b',
    uploaded: false,
    upload_progress: 0,
    width: 1,
    height: 1,
  },
  {
    local_id: 'photo-3',
    uri: 'c',
    uploaded: false,
    upload_progress: 0,
    width: 1,
    height: 1,
  },
]

const box = {
  lowerLeftX: 0.1,
  lowerLeftY: 0.1,
  upperRightX: 0.5,
  upperRightY: 0.5,
}

const navMachine = createMachine({
  id: 'annotateCarouselNav',
  initial: 'photo0',
  states: {
    photo0: {
      on: { CONFIRM: 'photo1', NOT_IN_PHOTO: 'photo1' },
    },
    photo1: {
      on: {
        CONFIRM: 'photo2',
        NOT_IN_PHOTO: 'photo2',
        PREV: 'photo0',
      },
    },
    photo2: {
      // Last photo (index 2 of 3) — Confirm/Not in Photo record the result
      // but do not advance past the end.
      on: { CONFIRM: 'completed', NOT_IN_PHOTO: 'completed', PREV: 'photo1' },
    },
    completed: {},
  },
})

describe('useAnnotatePass — carousel navigation (model-based test)', () => {
  let hook: ReturnType<
    typeof renderHook<ReturnType<typeof useAnnotatePass>, unknown>
  >

  beforeEach(() => {
    jest.clearAllMocks()
    useActiveCatFlowStore.getState().setActiveCatId(null)
    useBoundingBoxStore.getState().clearAll()
    useSubmissionStore.getState().clearDraft()
    usePhotoStore.setState({
      photos: THREE_PHOTOS,
      source: 'camera',
      submissionId: 'carousel-submission',
    })
    hook = renderHook(() => useAnnotatePass())
  })

  const model = createTestModel(navMachine)

  const testParams = {
    states: {
      photo0: () => expect(hook.result.current.currentIndex).toBe(0),
      photo1: () => expect(hook.result.current.currentIndex).toBe(1),
      photo2: () => expect(hook.result.current.currentIndex).toBe(2),
      completed: () => {
        expect(hook.result.current.currentIndex).toBe(2)
      },
    },
    events: {
      CONFIRM: () => {
        const photo =
          hook.result.current.photos[hook.result.current.currentIndex]
        act(() => hook.result.current.handleConfirmBox(box))
        if (photo) {
          expect(
            useBoundingBoxStore.getState().getBoxesForPhoto(photo.local_id),
          ).not.toHaveLength(0)
        }
      },
      NOT_IN_PHOTO: () => {
        const photo =
          hook.result.current.photos[hook.result.current.currentIndex]
        act(() => hook.result.current.handleNotInPhoto())
        if (photo) {
          expect(
            Object.keys(useBoundingBoxStore.getState().absences).some((key) =>
              key.endsWith(`:${photo.local_id}`),
            ),
          ).toBe(true)
        }
      },
      PREV: () => act(() => hook.result.current.handlePrevPhoto()),
    },
  }

  const journeys = [
    { name: 'starts on the first photo', events: [] },
    {
      name: 'confirming a box advances to the next photo',
      events: [{ type: 'CONFIRM' }],
    },
    {
      name: 'not-in-photo advances and completes on the last photo after a confirmed box',
      events: [
        { type: 'CONFIRM' },
        { type: 'NOT_IN_PHOTO' },
        { type: 'NOT_IN_PHOTO' },
      ],
    },
    {
      name: 'confirming on the last photo does not advance past the end',
      events: [{ type: 'CONFIRM' }, { type: 'CONFIRM' }, { type: 'CONFIRM' }],
    },
    {
      name: 'Previous steps back one photo at a time',
      events: [{ type: 'CONFIRM' }, { type: 'CONFIRM' }, { type: 'PREV' }],
    },
    {
      name: 'Previous on the first photo is a no-op',
      events: [{ type: 'PREV' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })

  it('completes the pass after boxing evidence exists', () => {
    useActiveCatFlowStore.getState().setActiveCatId('cat-with-box')
    useBoundingBoxStore.getState().addBox('cat-with-box', 'photo-1', box)

    act(() => hook.result.current.handleBoxingComplete())

    expect(router.replace).toHaveBeenCalledWith('/submission/cats')
    expect(useActiveCatFlowStore.getState().activeCatId).toBe('cat-with-box')
  })
})
