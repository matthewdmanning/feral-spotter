import { render, screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import SettingsScreen from '@/src/features/settings/screens/settings'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

const mutableFeatureFlags = FEATURE_FLAGS as {
  experimentalCamera: boolean
  emailUpdates: boolean
}
const originalExperimentalCamera = mutableFeatureFlags.experimentalCamera
const originalEmailUpdates = mutableFeatureFlags.emailUpdates

afterEach(() => {
  mutableFeatureFlags.experimentalCamera = originalExperimentalCamera
  mutableFeatureFlags.emailUpdates = originalEmailUpdates
})

it('applies a photo toggle and an instant choice to their stores at once', async () => {
  mutableFeatureFlags.emailUpdates = true
  useAuthStore.setState({
    user: { uid: 'owner', email: 'observer@example.test' },
    isReady: true,
  })
  const initial = useSettingsStore.getState().settings.keep_photos_on_device
  const user = userEvent.setup()
  await render(<SettingsScreen />)
  await user.press(screen.getByRole('switch', { name: 'Email Updates' }))
  expect(useConsentStore.getState().emailOptIn).toBe(true)
  await user.press(
    screen.getByRole('switch', { name: 'Keep Photos on Device' }),
  )
  expect(useSettingsStore.getState().settings.keep_photos_on_device).toBe(
    !initial,
  )
  expect(
    screen.queryByRole('button', { name: 'Save photo settings' }),
  ).toBeNull()
  expect(router.back).not.toHaveBeenCalled()
})

it('saves each capture priority as its native mapping at once', async () => {
  useSettingsStore.setState((state) => ({
    settings: {
      ...state.settings,
      camera_max_detail: true,
      camera_motion_priority: true,
    },
  }))
  const user = userEvent.setup()
  await render(<SettingsScreen />)

  expect(screen.getByText('Capture Priority')).toBeOnTheScreen()
  expect(screen.queryByText('Maximum Detail')).toBeNull()
  expect(screen.queryByText('Motion Priority')).toBeNull()
  expect(screen.queryByText('Disable Low-Light Boost')).toBeNull()

  const saved = () => {
    const { camera_max_detail, camera_motion_priority } =
      useSettingsStore.getState().settings
    return { camera_max_detail, camera_motion_priority }
  }
  await user.press(screen.getByRole('button', { name: 'Speed' }))
  expect(saved()).toEqual({
    camera_max_detail: false,
    camera_motion_priority: true,
  })
  await user.press(screen.getByRole('button', { name: 'Balanced' }))
  expect(saved()).toEqual({
    camera_max_detail: true,
    camera_motion_priority: true,
  })
  await user.press(screen.getByRole('button', { name: 'Quality' }))
  expect(saved()).toEqual({
    camera_max_detail: true,
    camera_motion_priority: false,
  })
})

it('hides capture priority when the experimental camera flag is off', async () => {
  mutableFeatureFlags.experimentalCamera = false

  await render(<SettingsScreen />)

  expect(screen.queryByText('Capture Priority')).toBeNull()
})
