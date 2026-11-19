import { render, screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import SettingsScreen from '@/src/features/settings/screens/settings'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { pressDialogButton } from '@/src/test-utils/dialog'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

it('discards only photo edits, preserves instant choices and saves within the photo group', async () => {
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
    initial,
  )
  await user.press(
    screen.getByRole('button', { name: 'Discard photo changes' }),
  )
  await pressDialogButton('Discard')
  expect(
    screen.getByRole('switch', { name: 'Keep Photos on Device' }).props
      .accessibilityState.checked,
  ).toBe(initial)
  expect(useConsentStore.getState().emailOptIn).toBe(true)
  await user.press(
    screen.getByRole('switch', { name: 'Keep Photos on Device' }),
  )
  await user.press(screen.getByRole('button', { name: 'Save photo settings' }))
  expect(useSettingsStore.getState().settings.keep_photos_on_device).toBe(
    !initial,
  )
  expect(router.back).not.toHaveBeenCalled()
})
