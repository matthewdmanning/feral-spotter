import { useCapturedPhotoWorkflow } from '@/src/features/camera-control/hooks/useCapturedPhotoWorkflow'
import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { Stack, router } from 'expo-router'
import {
  renderRouter,
  type RenderRouterResult,
} from 'expo-router/testing-library'
import { Pressable, Text } from 'react-native'

/**
 * Flow: Camera Done, first time and after Take More Photos
 * The user opens Camera from Home and taps Done, landing on Submission
 * Details. Later they tap Take More Photos, take more, and tap Done again.
 * They must return to the same Submission Details: Done used to stack a
 * new copy each time, each running its own draft sync.
 *
 * States:
 * - Home: Home alone on the stack.
 * - Camera: Camera above Home; draft ready.
 * - Submission Details: Home, then one Submission; Camera gone.
 * - Camera again: opened above that Submission Details.
 * Events: open Camera, tap Done, tap Take More Photos.
 */

jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('@/src/features/camera-control/components/CameraThumb', () => ({
  CameraThumb: 'CameraThumb',
}))

function Camera() {
  const { handleDone } = useCapturedPhotoWorkflow()
  return (
    <Pressable onPress={handleDone}>
      <Text>Done</Text>
    </Pressable>
  )
}

const routes = {
  _layout: () => <Stack />,
  index: () => <Text>Home</Text>,
  camera: Camera,
  'submission/_layout': () => <Stack />,
  'submission/create': () => <Text>Submission Details</Text>,
}

type StackState = { routes: { name: string; state?: StackState }[] }
let view: RenderRouterResult

/** Route names of the stack holding `name`, bottom to top. */
function stackHolding(name: string): string[] {
  const find = (state?: StackState): StackState | undefined => {
    if (state?.routes.some((r) => r.name === name)) return state
    for (const route of state?.routes ?? []) {
      const nested = find(route.state)
      if (nested) return nested
    }
    return undefined
  }
  const root = view.getRouterState() as StackState | undefined
  return find(root)?.routes.map((r) => r.name) ?? []
}

async function pressDone() {
  await userEvent.setup().press(screen.getByText('Done'))
  await waitFor(() =>
    expect(screen.getByText('Submission Details')).toBeOnTheScreen(),
  )
}

beforeEach(() => {
  useSettingsStore.getState().updateSetting('keep_photos_on_device', false)
  useDraftStartupStore.setState({ phase: 'ready', task: Promise.resolve() })
})

it('Done from Home opens Submission Details in place of Camera', async () => {
  view = await renderRouter(routes, { initialUrl: '/' })
  await act(async () => {
    router.navigate('/camera')
  })
  await pressDone()
  expect(stackHolding('submission')).toEqual(['index', 'submission'])
})

it('Done after Take More Photos returns to the open Submission Details', async () => {
  view = await renderRouter(routes, { initialUrl: '/' })
  await act(async () => {
    router.navigate('/camera')
  })
  await pressDone()
  await act(async () => {
    router.navigate('/camera')
  })
  await pressDone()
  expect(stackHolding('submission')).toEqual(['index', 'submission'])
})
