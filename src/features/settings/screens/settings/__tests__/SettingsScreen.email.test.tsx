import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { authProvider } from '@/src/features/auth/lib'
import { AlertHost } from '@/src/shared/ui/organisms/AlertHost'
import { pressDialogButton } from '@/src/test-utils/dialog'
import SettingsScreen from '@/src/features/settings/screens/settings'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'settings-user', email: 'observer@example.test' },
    isReady: true,
  })
})

it('does not show an email-entry dialog when the account already has email', async () => {
  await render(<SettingsScreen />)

  expect(screen.queryByText('Add your email')).toBeNull()
  expect(screen.queryByLabelText('New email')).toBeNull()
  expect(screen.queryByLabelText('Email')).toBeNull()
})

it('prompts once for an account without email and stays dismissed after Cancel', async () => {
  await act(async () => {
    useAuthStore.setState({
      user: { uid: 'missing-email-user', email: null },
      isReady: true,
    })
  })
  await render(<SettingsScreen />)

  expect(screen.getByText('Add your email')).toBeOnTheScreen()
  expect(screen.getByLabelText('Email')).toBeOnTheScreen()

  await userEvent.type(screen.getByLabelText('Email'), 'private@example.test')
  await userEvent.press(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Add your email')).toBeNull()

  await act(async () => {
    useAuthStore.setState({
      user: { uid: 'missing-email-user', email: null },
      isReady: true,
    })
  })
  await waitFor(() => expect(screen.queryByText('Add your email')).toBeNull())

  await act(async () => {
    useAuthStore.setState({
      user: { uid: 'account-with-email', email: 'account@example.test' },
      isReady: true,
    })
  })
  expect(screen.queryByText('Add your email')).toBeNull()

  await act(async () => {
    useAuthStore.setState({
      user: { uid: 'second-missing-email-user', email: null },
      isReady: true,
    })
  })
  await waitFor(() =>
    expect(screen.getByText('Add your email')).toBeOnTheScreen(),
  )
  expect(screen.getByLabelText('Email').props.value).toBe('')
})

it('keeps validation and change-email failures on the existing error path', async () => {
  useAuthStore.setState({
    user: { uid: 'missing-email-user', email: null },
    isReady: true,
  })
  await render(
    <>
      <SettingsScreen />
      <AlertHost />
    </>,
  )

  await userEvent.type(screen.getByLabelText('Email'), 'invalid')
  await userEvent.press(
    screen.getByRole('button', { name: 'Send verification link' }),
  )
  expect(screen.getByText('Enter a valid email address')).toBeOnTheScreen()
  await pressDialogButton('OK')
  expect(screen.queryByText('Add your email')).toBeNull()
  await userEvent.press(screen.getByRole('button', { name: 'Add email' }))

  await userEvent.clear(screen.getByLabelText('Email'))
  await userEvent.type(screen.getByLabelText('Email'), 'new@example.test')
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest
    .spyOn(authProvider, 'changeEmail')
    .mockRejectedValueOnce({ code: 'auth/requires-recent-login' })
  await userEvent.press(
    screen.getByRole('button', { name: 'Send verification link' }),
  )

  expect(authProvider.changeEmail).toHaveBeenCalledWith('new@example.test')
  expect(screen.getByText('Could not change email')).toBeOnTheScreen()
  expect(
    screen.getByText('Sign out and sign in again, then try once more.'),
  ).toBeOnTheScreen()
  await pressDialogButton('OK')
  await userEvent.press(screen.getByRole('button', { name: 'Add email' }))
  expect(screen.getByText('Add your email')).toBeOnTheScreen()
})

it('closes the entry dialog and confirms a successful verification request', async () => {
  useAuthStore.setState({
    user: { uid: 'missing-email-user', email: null },
    isReady: true,
  })
  const changeEmail = jest
    .spyOn(authProvider, 'changeEmail')
    .mockResolvedValueOnce()
  await render(
    <>
      <SettingsScreen />
      <AlertHost />
    </>,
  )

  await userEvent.type(screen.getByLabelText('Email'), 'new@example.test')
  await userEvent.press(
    screen.getByRole('button', { name: 'Send verification link' }),
  )

  expect(changeEmail).toHaveBeenCalledWith('new@example.test')
  expect(screen.queryByText('Add your email')).toBeNull()
  expect(screen.getByText('Check your email')).toBeOnTheScreen()
})
