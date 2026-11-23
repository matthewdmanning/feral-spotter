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
 * Flow: the cat pass, Cat List → Annotate → Cat Form → Cat List
 * With one cat recorded, the user taps Add a Cat, boxes it in Annotate, and
 * reaches Cat Form. They save the cat or abandon it, or edit a cat and
 * remove it. Each way ends on the one Cat List they started from: a
 * replace used to leave a second Cat List, with its own draft sync, per cat.
 *
 * States:
 * - Cat List: one cat recorded; one photo in the draft.
 * - Annotate: pushed above Cat List.
 * - Cat Form: replaces Annotate (new cat) or is pushed (edit).
 * - Back on Cat List: the submission stack holds Cat List alone.
 * - First cat: Cat Form reached by replaces, with no Cat List beneath;
 *   leaving adds one in its place.
 * Events: Add a Cat, Boxing Complete, Save, abandon, Edit, Remove.
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
