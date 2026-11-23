import { submissionPhoto } from '@/src/test-utils/photoFixtures'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { act, screen } from '@testing-library/react-native'
import {
  renderRouter,
  type RenderRouterResult,
} from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { Text } from 'react-native'
import { observedCat } from '@/src/test-utils/catFixtures'
import {
  abandonCatPass,
  finishBoxing,
  openCatForm,
  returnToCatList,
  returnToCatListAfterRemoval,
  startCatPass,
} from '@/src/features/draft-submission/hooks/catPass'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'

/**
 * The cat pass against the real router. Each pass leaves from Cat List and
 * comes back to it, so the stack must end where it started: a second Cat
 * List under the first kept a second Submission Details mounted, running
 * its own draft sync, for every cat recorded.
 */

const routes = {
  _layout: () => <Stack />,
  index: () => <Text>Home</Text>,
  'submission/_layout': () => <Stack />,
  'submission/create': () => <Text>Cat List</Text>,
  'submission/annotate': () => <Text>Annotate</Text>,
  'submission/cats': () => <Text>Cat Form</Text>,
}

type StackState = { routes: { name: string; state?: StackState }[] }
let view: RenderRouterResult

/** Route names of the submission stack, bottom to top. */
function submissionStack(): string[] {
  const find = (state?: StackState): StackState | undefined => {
    for (const route of state?.routes ?? []) {
      if (route.name === 'submission') return route.state
      const nested = find(route.state)
      if (nested) return nested
    }
    return undefined
  }
  const root = view.getRouterState() as StackState | undefined
  return find(root)?.routes.map((r) => r.name) ?? []
}

async function run(step: () => void) {
  await act(async () => {
    step()
  })
}

beforeEach(() => {
  useSubmissionStore.getState().clearDraft()
  usePhotoStore.setState({ photos: [submissionPhoto()] })
  useSubmissionStore.getState().addCat(observedCat({ local_id: 'cat-1' }))
})

it.each([
  ['saving a new cat', () => returnToCatList()],
  ['abandoning the pass', () => abandonCatPass()],
])('%s returns to the one Cat List', async (_name, leave) => {
  view = await renderRouter(routes, { initialUrl: '/submission/create' })
  await run(startCatPass)
  await run(finishBoxing)
  expect(submissionStack()).toEqual(['create', 'cats'])
  await run(leave)
  expect(submissionStack()).toEqual(['create'])
  expect(screen.getByText('Cat List')).toBeOnTheScreen()
})

it('removing a cat from an edit returns to the one Cat List', async () => {
  view = await renderRouter(routes, { initialUrl: '/submission/create' })
  await run(() => openCatForm('cat-1'))
  await run(returnToCatListAfterRemoval)
  expect(submissionStack()).toEqual(['create'])
})

it('the first cat, reached by replaces, still lands on a Cat List', async () => {
  view = await renderRouter(routes, { initialUrl: '/submission/cats' })
  await run(returnToCatList)
  expect(submissionStack()).toEqual(['create'])
})
