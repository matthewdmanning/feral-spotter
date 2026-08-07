import { render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import CreateSubmissionScreen from '../index'

/**
 * Model of the Cat List zero-friction on-ramp gate (#173): with no cats
 * recorded, Cat List renders nothing and redirects straight into annotate;
 * with at least one cat, it renders normally. Mirrors
 * HomeScreen.photoSourceGate.model.test.tsx's pattern — render the real
 * screen, mock its store/router deps, gate on a small machine rather than
 * driving the persisted useSubmissionStore live (same react-test-renderer +
 * AsyncStorage-rehydration crash this repo's other screen tests route
 * around).
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

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'sub-1') }))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

jest.mock('@/src/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
  }),
}))

jest.mock('@/src/lib/location', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: () => anyProp() })
  const theme = new Proxy({}, { get: () => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  CheckCircle: () => null,
}))

type Cat = {
  local_id: string
  age: string
  pattern: string
  hair_length: string
}

let mockCats: Cat[] = []

jest.mock('@/src/hooks/useSubmissionStore', () => ({
  useSubmissionStore: (
    sel: (s: {
      submission: { location_type: string; time_type: string }
      cats: Cat[]
      setSubmissionLocation: jest.Mock
      setManualTime: jest.Mock
      setCurrentStep: jest.Mock
    }) => unknown,
  ) =>
    sel({
      submission: { location_type: 'device', time_type: 'device' },
      cats: mockCats,
      setSubmissionLocation: jest.fn(),
      setManualTime: jest.fn(),
      setCurrentStep: jest.fn(),
    }),
}))

// emptiedAfterHavingCats is a distinct state from emptyList, not a return
// to it: both have cats.length === 0, but the expected behavior differs by
// history. #189 found that assumption wrong — handleReset's clearDraft()
// can leave this screen mounted with cats.length dropping to 0 while
// still here (its own router.replace('/') racing this effect's
// replace('/submission/annotate'), a race ordering can't fix since
// useEffect always runs after the triggering callback finishes). The real
// fix (create/index.tsx) gates the redirect on a mount-time snapshot, not
// a live cats.length watch, so it must never re-fire once cats had been
// non-empty during this mount — that's what emptiedAfterHavingCats pins.
const gateMachine = createMachine({
  id: 'catListAutoSkip',
  initial: 'emptyList',
  states: {
    emptyList: {
      on: { CAT_ADDED: 'hasCats' },
    },
    hasCats: {
      on: { CAT_REMOVED: 'emptiedAfterHavingCats' },
    },
    emptiedAfterHavingCats: {},
  },
})

describe('Cat List auto-skip gate — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void
  let queryByText: ReturnType<typeof render>['queryByText']

  beforeEach(() => {
    jest.clearAllMocks()
    mockCats = []
    const result = render(<CreateSubmissionScreen />)
    queryByText = result.queryByText
    rerender = result.rerender
  })

  const model = createTestModel(gateMachine)

  const testParams = {
    states: {
      emptyList: async () => {
        await waitFor(() => {
          expect(router.replace).toHaveBeenCalledWith('/submission/annotate')
        })
        expect(queryByText('Cats Recorded')).toBeNull()
      },
      hasCats: async () => {
        await waitFor(() => {
          expect(queryByText('Cats Recorded')).not.toBeNull()
        })
        // Regression guard for "don't redirect when cats exist" — the
        // emptyList assertion above already proved one call happened on
        // the initial empty render; this proves adding a cat doesn't add
        // a second, spurious one.
        expect(router.replace).toHaveBeenCalledTimes(1)
      },
      emptiedAfterHavingCats: async () => {
        // #189 regression: cats.length dropping back to 0 mid-mount (e.g.
        // Reset) must not re-trigger the redirect — only the mount-time
        // snapshot should. queryByText/getByTestId aren't useful here
        // (render returns null once cats.length === 0 again, same as
        // emptyList), so the only meaningful assertion is the call count
        // staying at its emptyList-state value.
        expect(router.replace).toHaveBeenCalledTimes(1)
      },
    },
    events: {
      CAT_ADDED: () => {
        mockCats = [
          {
            local_id: 'cat-1',
            age: 'adult',
            pattern: 'tabby',
            hair_length: 'short',
          },
        ]
        rerender(<CreateSubmissionScreen />)
      },
      CAT_REMOVED: () => {
        mockCats = []
        rerender(<CreateSubmissionScreen />)
      },
    },
  }

  const journeys = [
    {
      name: 'zero cats redirects straight into annotate, no Cat List render',
      events: [] as const,
    },
    {
      name: 'adding the first cat renders Cat List instead of redirecting again',
      events: [{ type: 'CAT_ADDED' }],
    },
    {
      name: 'removing the only cat after having one does not re-trigger the auto-skip redirect',
      events: [{ type: 'CAT_ADDED' }, { type: 'CAT_REMOVED' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
