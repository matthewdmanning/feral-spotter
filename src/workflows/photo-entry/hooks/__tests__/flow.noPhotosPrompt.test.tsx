import AnnotateScreen from '@/src/features/annotate/screens/annotate/index'
import {
  returnToCatList,
  startCatPass,
  useCatListLanding,
} from '@/src/features/draft-submission/hooks/catPass'
import { removePhotoFromDraft } from '@/src/features/draft-submission/hooks/removePhotoFromDraft'
import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { noPhotosCopy, submissionCopy } from '@/src/shared/config/text'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { pressDialogButton } from '@/src/test-utils/dialog'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'
import { useNoPhotosPrompt } from '@/src/workflows/photo-entry/hooks/useNoPhotosPrompt'
import { act, screen, userEvent } from '@testing-library/react-native'
import { Stack, router } from 'expo-router'
import {
  renderRouter,
  type RenderRouterResult,
} from 'expo-router/testing-library'
import { Pressable, Text } from 'react-native'

/**
 * Flow: no photos to annotate (#503)
 * The user's Sighting has no photos left: they never had one, or they
 * removed the last one in Annotate. Annotate must never open empty. Cat
 * List asks instead: get more photos from the Sighting's own source, Just
 * Describe a cat, or Back to Cat List (cats recorded) / Cancel Sighting
 * (none recorded).
 *
 * States:
 * - Cat List, asking: no photos; the dialog is open; no jump into Annotate.
 * - Annotate: at least one photo; pushed above Cat List, or in its place
 *   for the first cat.
 * - Cat List after removal: the pass's cat id is cleared; stack holds Cat
 *   List alone; the dialog opens.
 * - Cat Form, Camera, or the Reset confirmation: after the chosen option.
 * - Cat List, done with photos: the user chose Just Describe; Cat List
 *   no longer asks by itself, also after a restart; Annotate Photos
 *   still asks. A new photo ends this state.
 * - Torn down: Submit or Reset emptied the draft on Cat List; no dialog.
 * Events: open Cat List, Annotate Photos, remove the last photo, choose
 * each option, return from Cat Form, add a photo, close the dialog with
 * Back, tear the draft down.
 */

jest.mock('react-native-reanimated-carousel', () => 'Carousel')

/** Cat List's wiring of the prompt, as the create screen does it. */
function CatList() {
  const { autoSkipPending } = useCatListLanding()
  const { offer } = useNoPhotosPrompt()
  if (autoSkipPending) return null
  return (
    <Pressable onPress={() => startCatPass() || offer()}>
      <Text>Annotate Photos</Text>
    </Pressable>
  )
}

const routes = {
  _layout: () => <Stack />,
  index: () => <Text>Home</Text>,
  camera: () => <Text>Camera</Text>,
  'submission/_layout': () => <Stack />,
  'submission/create': CatList,
  'submission/annotate': AnnotateScreen,
  'submission/cats': () => <Text>Cat Form</Text>,
}

type StackState = { routes: { name: string; state?: StackState }[] }
let view: RenderRouterResult

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

const dialogButtons = () =>
  useUIStore.getState().dialog?.buttons.map((b) => b.text)

/** Home, then into the submission flow, as Camera's Done or Continue do. */
async function openCatList() {
  view = await renderRouter(routes, { initialUrl: '/' })
  await act(async () => {
    router.push('/submission/create')
  })
}

const addPhoto = () =>
  usePhotoStore.getState().addPhoto(submissionPhoto({ local_id: 'p1' }))
const recordCat = () =>
  useSubmissionStore.getState().addCat(observedCat({ local_id: 'cat-1' }))

beforeEach(() => {
  useDraftStartupStore.setState({ phase: 'ready', task: Promise.resolve() })
})

it('Cat List with no photos stays put and asks; Just Describe opens Cat Form', async () => {
  await openCatList()
  expect(screen.getByText('Annotate Photos')).toBeOnTheScreen()
  expect(useUIStore.getState().dialog?.title).toBe(noPhotosCopy.title)
  expect(dialogButtons()).toEqual([
    noPhotosCopy.takePhotos,
    noPhotosCopy.justDescribe,
    noPhotosCopy.cancelSighting,
  ])
  await pressDialogButton(noPhotosCopy.justDescribe)
  expect(await screen.findByText('Cat Form')).toBeOnTheScreen()
})

it('after Just Describe, Cat List stops asking until Annotate Photos', async () => {
  usePhotoStore.getState().addPhotos([submissionPhoto({ local_id: 'p1' })])
  await openCatList()
  // Auto-skipped into Annotate; removing the only photo ends on Cat List.
  await act(async () => {
    removePhotoFromDraft('p1')
  })
  expect(dialogButtons()?.[0]).toBe(noPhotosCopy.uploadPhotos)
  await pressDialogButton(noPhotosCopy.justDescribe)
  expect(await screen.findByText('Cat Form')).toBeOnTheScreen()
  // Save on Cat Form: back to Cat List.
  await act(async () => {
    recordCat()
    returnToCatList()
  })
  expect(await screen.findByText('Annotate Photos')).toBeOnTheScreen()
  expect(useUIStore.getState().dialog).toBeNull()
  // Asking for Annotate still explains why it cannot open.
  await userEvent.press(screen.getByText('Annotate Photos'))
  expect(useUIStore.getState().dialog?.title).toBe(noPhotosCopy.title)
})

it('returning to an already-empty Cat List does not reopen a dismissed prompt', async () => {
  recordCat()
  await openCatList()
  await pressDialogButton(noPhotosCopy.backToCatList)

  await act(async () => {
    router.push('/submission/cats')
  })
  expect(await screen.findByText('Cat Form')).toBeOnTheScreen()
  await act(async () => {
    returnToCatList()
  })

  expect(await screen.findByText('Annotate Photos')).toBeOnTheScreen()
  expect(useUIStore.getState().dialog).toBeNull()
})

it('a restored draft the user finished photographing opens without asking', async () => {
  recordCat()
  usePhotoStore.setState({ done_adding_photos: true })
  await openCatList()
  expect(screen.getByText('Annotate Photos')).toBeOnTheScreen()
  expect(useUIStore.getState().dialog).toBeNull()
})

it('adding a photo again re-arms the prompt for its removal', async () => {
  usePhotoStore.setState({ done_adding_photos: true })
  addPhoto()
  expect(usePhotoStore.getState().done_adding_photos).toBe(false)
})

it('Cancel Sighting asks to confirm the reset', async () => {
  await openCatList()
  await pressDialogButton(noPhotosCopy.cancelSighting)
  expect(useUIStore.getState().dialog?.title).toBe(
    submissionCopy.exit.resetTitle,
  )
})

it('removing the first cat pass’s last photo ends on a fresh Cat List', async () => {
  addPhoto()
  await openCatList()
  // No cat recorded: Cat List auto-skipped into Annotate.
  expect(submissionStack()).toEqual(['annotate'])
  useActiveCatFlowStore.getState().setActiveCatId('cat-new')
  await act(async () => {
    removePhotoFromDraft('p1')
  })
  expect(await screen.findByText('Annotate Photos')).toBeOnTheScreen()
  expect(submissionStack()).toEqual(['create'])
  expect(useActiveCatFlowStore.getState().activeCatId).toBeNull()
  // The camera draft's photos are gone, but its source is remembered.
  expect(dialogButtons()?.[0]).toBe(noPhotosCopy.takePhotos)
  await pressDialogButton(noPhotosCopy.takePhotos)
  expect(await screen.findByText('Camera')).toBeOnTheScreen()
})

it('with a cat recorded, removing the last photo offers Back to Cat List', async () => {
  addPhoto()
  recordCat()
  await openCatList()
  await userEvent.press(screen.getByText('Annotate Photos'))
  expect(submissionStack()).toEqual(['create', 'annotate'])
  useBoundingBoxStore.getState().addBox('cat-new', 'p1', {
    lowerLeftX: 0.1,
    lowerLeftY: 0.9,
    upperRightX: 0.6,
    upperRightY: 0.2,
  })
  await act(async () => {
    removePhotoFromDraft('p1')
  })
  expect(submissionStack()).toEqual(['create'])
  expect(dialogButtons()).toEqual([
    noPhotosCopy.takePhotos,
    noPhotosCopy.justDescribe,
    noPhotosCopy.backToCatList,
  ])
  await pressDialogButton(noPhotosCopy.backToCatList)
  expect(useUIStore.getState().dialog).toBeNull()
  expect(screen.getByText('Annotate Photos')).toBeOnTheScreen()
})

it('Annotate Photos with no photos asks instead of opening Annotate', async () => {
  recordCat()
  await openCatList()
  await act(async () => {
    useUIStore.getState().dismissDialog()
  })
  await userEvent.press(screen.getByText('Annotate Photos'))
  expect(submissionStack()).toEqual(['create'])
  expect(useUIStore.getState().dialog?.title).toBe(noPhotosCopy.title)
})

it('a library draft offers Upload Photos', async () => {
  usePhotoStore.setState({ last_source: 'library' })
  await openCatList()
  expect(dialogButtons()?.[0]).toBe(noPhotosCopy.uploadPhotos)
})

it('tearing the draft down on Cat List asks nothing', async () => {
  addPhoto()
  recordCat()
  await openCatList()
  expect(useUIStore.getState().dialog).toBeNull()
  await act(async () => {
    usePhotoStore.getState().clearPhotos()
  })
  expect(useUIStore.getState().dialog).toBeNull()
})
