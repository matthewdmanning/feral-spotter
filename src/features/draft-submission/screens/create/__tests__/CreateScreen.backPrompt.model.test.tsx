import { act, render } from '@testing-library/react-native'
import React from 'react'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import CreateSubmissionScreen from '@/src/features/draft-submission/screens/create/index'
import { pressDialogButton } from '@/src/test-utils/dialog'

/**
 * Model of Android hardware Back on Submission Details. The header back and
 * swipe-back are off there (#156), so Back used to pop to Home, which offers
 * a draft's owner nothing. It now asks: stay, add more photos, or discard.
 *
 * The handler must stay quiet while a screen above this one has focus (Cat
 * Form, the map picker): this screen is still mounted under them, and their
 * Back must not open this prompt. Mocking pattern follows
 * CreateScreen.addMorePhotosAction.model.test.tsx.
 */

let mockFocused = true

jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  useLocalSearchParams: () => ({}),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
}))

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('@/src/features/draft-submission/lib/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

const mockDiscard = jest.fn()

jest.mock('@/src/features/draft-submission/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
    handleDiscard: mockDiscard,
  }),
}))

jest.mock('@/src/features/library-picker/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

// Draft sync has its own tests (useDraftSync.*.test.ts); this suite covers the screen's wiring.
jest.mock('@/src/features/draft-submission/hooks/useDraftSync', () => ({
  useDraftSync: () => undefined,
}))

jest.mock('@/src/features/draft-submission/hooks/usePhotoStore', () => ({
  usePhotoStore: (sel: (s: { source: 'camera' }) => unknown) =>
    sel({ source: 'camera' }),
}))

jest.mock('@/src/features/draft-submission/hooks/useSubmissionStore', () => ({
  useSubmissionStore: (sel: (s: unknown) => unknown) =>
    sel({
      submission: { location_type: 'device', time_type: 'device' },
      cats: [
        {
          local_id: 'cat-1',
          age: 'adult',
          pattern: 'tabby',
          hair_length: 'short',
        },
      ],
      setSubmissionLocation: jest.fn(),
      setManualTime: jest.fn(),
    }),
}))

// The platform check inside the real hook only registers on Android; the
// screen's own handler is what this test is about, so capture it directly.
let mockBackHandler: () => boolean = () => false
jest.mock('@/src/shared/hooks/useBackHandler', () => ({
  useBackHandler: (handler: () => boolean) => {
    mockBackHandler = handler
  },
}))

const backMachine = createMachine({
  id: 'submissionDetailsBack',
  initial: 'details',
  states: {
    details: { on: { BACK: 'prompt', COVER: 'covered' } },
    prompt: {
      on: { STAY: 'details', TAKE_MORE: 'camera', DISCARD: 'home' },
    },
    covered: { on: { BACK: 'covered', UNCOVER: 'details' } },
    camera: {},
    home: {},
  },
})

const dialog = () => useUIStore.getState().dialog

describe('Submission Details hardware Back — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void
  let lastBackHandled: boolean

  beforeEach(() => {
    mockFocused = true
    useUIStore.setState({ dialog: null })
    lastBackHandled = false
    const result = await render(<CreateSubmissionScreen />)
    rerender = result.rerender
  })

  const model = createTestModel(backMachine)

  const testParams = {
    states: {
      details: () => {
        expect(dialog()).toBeNull()
      },
      prompt: () => {
        expect(lastBackHandled).toBe(true)
        expect(dialog()?.title).toBe('Leave Submission?')
        expect(dialog()?.buttons.map((b) => b.text)).toEqual([
          'Stay',
          'Take More Photos',
          'Discard Draft',
        ])
      },
      // Back is left to the screen above, which owns it.
      covered: () => {
        expect(lastBackHandled).toBe(false)
        expect(dialog()).toBeNull()
      },
      camera: () => {
        expect(router.navigate).toHaveBeenCalledWith('/camera')
        expect(mockDiscard).not.toHaveBeenCalled()
      },
      home: () => {
        expect(mockDiscard).toHaveBeenCalledTimes(1)
        expect(router.navigate).not.toHaveBeenCalled()
      },
    },
    events: {
      BACK: async () => {
        await act(() => {
          lastBackHandled = mockBackHandler()
        })
      },
      STAY: async () => await pressDialogButton('Stay'),
      TAKE_MORE: async () => await pressDialogButton('Take More Photos'),
      DISCARD: async () => await pressDialogButton('Discard Draft'),
      COVER: async () => {
        mockFocused = false
        await rerender(<CreateSubmissionScreen />)
      },
      UNCOVER: async () => {
        mockFocused = true
        await rerender(<CreateSubmissionScreen />)
      },
    },
  }

  const journeys = [
    {
      name: 'Back asks, and Stay keeps the user on the page',
      events: [{ type: 'BACK' }, { type: 'STAY' }],
    },
    {
      name: 'Back then Take More Photos reopens the camera and keeps the draft',
      events: [{ type: 'BACK' }, { type: 'TAKE_MORE' }],
    },
    {
      name: 'Back then Discard Draft clears the draft and leaves',
      events: [{ type: 'BACK' }, { type: 'DISCARD' }],
    },
    {
      name: 'Back is ignored while a screen above has focus, and works again after',
      events: [
        { type: 'COVER' },
        { type: 'BACK' },
        { type: 'UNCOVER' },
        { type: 'BACK' },
      ],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
