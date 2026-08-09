import { act, renderHook } from '@testing-library/react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useAnnotatePass } from '../useAnnotatePass'

/**
 * Models useAnnotatePass's carousel-position logic (src/hooks/useAnnotatePass.ts)
 * — Confirm Box and Not in Photo both advance to the next photo, except from
 * the last photo (no auto-advance, per the doc comment "Boxing Complete, not
 * auto-advance, ends the pass"); Previous moves back but never past 0.
 * useActiveCatFlow (the cat-discovery/persistence layer this hook wraps) is
 * already fully modeled in useActiveCatFlow.model.test.ts — mocked here to a
 * bare no-op so this model stays scoped to position, not re-testing that.
 * The remove-confirmation branching (handleLongPressRemove) is a pure
 * decision, not a flow — covered separately in
 * useAnnotatePass.removeConfirm.test.ts with plain cases, matching this
 * repo's convention for non-stateful branching (see libraryPickTime.test.ts).
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

jest.mock('../useActiveCatFlow', () => ({
  useActiveCatFlow: () => ({
    activeCatId: null,
    getPhotoStatus: () => 'pending',
    handleBoxConfirmed: jest.fn(),
    handleNotInPhoto: jest.fn(),
    handleBoxingComplete: jest.fn(),
    clearActiveCat: jest.fn(),
    handleAbandonPass: jest.fn(),
  }),
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

jest.mock('@/src/hooks', () => ({
  usePhotoStore: (sel: (s: object) => unknown) =>
    sel({ photos: THREE_PHOTOS, removePhoto: jest.fn() }),
}))
jest.mock('@/src/hooks/useAnnotationStore', () => ({
  useAnnotationStore: (sel: (s: object) => unknown) =>
    sel({ annotationSets: {}, removeAnnotationSet: jest.fn() }),
}))
jest.mock('@/src/hooks/useBoundingBoxStore', () => ({
  useBoundingBoxStore: (sel: (s: object) => unknown) =>
    sel({ removeBoxesForPhoto: jest.fn() }),
}))
jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (sel: (s: object) => unknown) =>
    sel({
      settings: { skip_photo_remove_confirm: false },
      updateSetting: jest.fn(),
    }),
}))

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
      on: { CONFIRM: 'photo2', NOT_IN_PHOTO: 'photo2', PREV: 'photo1' },
    },
  },
})

describe('useAnnotatePass — carousel navigation (model-based test)', () => {
  let hook: ReturnType<
    typeof renderHook<ReturnType<typeof useAnnotatePass>, unknown>
  >

  beforeEach(() => {
    hook = renderHook(() => useAnnotatePass())
  })

  const model = createTestModel(navMachine)

  const testParams = {
    states: {
      photo0: () => expect(hook.result.current.currentIndex).toBe(0),
      photo1: () => expect(hook.result.current.currentIndex).toBe(1),
      photo2: () => expect(hook.result.current.currentIndex).toBe(2),
    },
    events: {
      CONFIRM: () => act(() => hook.result.current.handleConfirmBox(box)),
      NOT_IN_PHOTO: () => act(() => hook.result.current.handleNotInPhoto()),
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
      name: 'not-in-photo advances the same as a confirmed box',
      events: [{ type: 'NOT_IN_PHOTO' }],
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
})
