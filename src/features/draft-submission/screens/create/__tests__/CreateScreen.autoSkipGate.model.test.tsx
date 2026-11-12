import { act, render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { router } from 'expo-router'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import CreateSubmissionScreen from '@/src/features/draft-submission/screens/create/index'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { observedCat } from '@/src/test-utils/catFixtures'

/**
 * Model of the Cat List zero-friction on-ramp gate (#173): with no cats
 * recorded, Cat List renders nothing and redirects straight into annotate;
 * with at least one cat, it renders normally. Mirrors
 * HomeScreen.photoSourceGate.model.test.tsx's pattern — render the real
 * screen against the real submission store, gate on a small machine.
 */

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/src/shared/lib/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

jest.mock('@/src/features/draft-submission/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
  }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
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
  let queryByText: Awaited<ReturnType<typeof render>>['queryByText']

  beforeEach(async () => {
    const result = await render(<CreateSubmissionScreen />)
    queryByText = result.queryByText
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
      CAT_ADDED: async () => {
        await act(() => useSubmissionStore.setState({ cats: [observedCat()] }))
      },
      CAT_REMOVED: async () => {
        await act(() => useSubmissionStore.setState({ cats: [] }))
      },
    },
  }

  const journeys = [
    {
      name: 'removing the only cat after having one does not re-trigger the auto-skip redirect',
      events: [{ type: 'CAT_ADDED' }, { type: 'CAT_REMOVED' }],
    },
  ]

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
