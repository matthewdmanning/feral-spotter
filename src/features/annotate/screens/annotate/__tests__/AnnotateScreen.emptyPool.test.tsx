import AnnotateScreen from '@/src/features/annotate/screens/annotate/index'
import { useCatListLanding } from '@/src/features/draft-submission/hooks/catPass'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { annotateCopy } from '@/src/shared/config/text'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { AlertHost } from '@/src/shared/ui/organisms/AlertHost'
import { pressDialogButton } from '@/src/test-utils/dialog'
import { act, screen, userEvent } from '@testing-library/react-native'
import { Stack, router } from 'expo-router'
import {
  renderRouter,
  type RenderRouterResult,
} from 'expo-router/testing-library'
import { Text } from 'react-native'

/**
 * Annotate with no photos left (#503), on the real router. The first cat's
 * Annotate is reached by Cat List's auto-skip, so a plain Back left the
 * submission flow. Now a dialog offers three ways on, and each lands
 * somewhere useful: never back into this empty screen.
 */

jest.mock('react-native-reanimated-carousel', () => 'Carousel')

function CatList() {
  const { autoSkipPending } = useCatListLanding()
  return autoSkipPending ? null : <Text>Cat List</Text>
}

const routes = {
  _layout: () => (
    <>
      <Stack />
      <AlertHost />
    </>
  ),
  index: () => <Text>Home</Text>,
  camera: () => <Text>Camera</Text>,
  'submission/_layout': () => <Stack />,
  'submission/create': CatList,
  'submission/annotate': AnnotateScreen,
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
  return (
    find(view.getRouterState() as StackState)?.routes.map((r) => r.name) ?? []
  )
}

/** The first cat's pass: Cat List auto-skips into Annotate, no photos left. */
async function openEmptyAnnotate() {
  view = await renderRouter(routes, { initialUrl: '/' })
  await act(async () => {
    router.push('/submission/create')
  })
  expect(await screen.findByText(annotateCopy.noPhotosTitle)).toBeOnTheScreen()
  expect(submissionStack()).toEqual(['annotate'])
}

beforeEach(() => {
  useDraftStartupStore.setState({ phase: 'ready', task: Promise.resolve() })
  // A pass already started: its cat and box must not outlive the exit.
  useActiveCatFlowStore.getState().setActiveCatId('cat-new')
  useBoundingBoxStore.getState().addBox('cat-new', 'p1', {
    lowerLeftX: 0.1,
    lowerLeftY: 0.9,
    upperRightX: 0.6,
    upperRightY: 0.2,
  })
})

function expectPassCleared() {
  expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
  expect(useBoundingBoxStore.getState().getBoxesForCat('cat-new')).toEqual([])
}

it('Continue lands on Cat List and stays there', async () => {
  await openEmptyAnnotate()
  await pressDialogButton(annotateCopy.continue)
  expect(await screen.findByText('Cat List')).toBeOnTheScreen()
  expect(submissionStack()).toEqual(['create'])
  expectPassCleared()
})

it('Skip Annotating opens Cat Form in place of Annotate', async () => {
  await openEmptyAnnotate()
  await pressDialogButton(annotateCopy.skipAnnotating)
  expect(await screen.findByText('Cat Form')).toBeOnTheScreen()
  expect(submissionStack()).toEqual(['cats'])
  expectPassCleared()
})

it('Take More Photos opens Camera', async () => {
  await openEmptyAnnotate()
  await pressDialogButton(annotateCopy.takeMorePhotos)
  expect(await screen.findByText('Camera')).toBeOnTheScreen()
  expectPassCleared()
})

it('the question comes back after Back dismisses it', async () => {
  await openEmptyAnnotate()
  await act(async () => {
    useUIStore.getState().dismissDialog()
  })
  expect(screen.queryByText(annotateCopy.noPhotosTitle)).toBeNull()
  await userEvent.press(screen.getByText(annotateCopy.chooseNextStep))
  expect(screen.getByText(annotateCopy.noPhotosTitle)).toBeOnTheScreen()
})
