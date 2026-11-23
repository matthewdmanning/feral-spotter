import { useAuthAttempt } from '@/src/features/auth/hooks/useAuthAttempt'
import { act, screen, userEvent } from '@testing-library/react-native'
import { Stack, router } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { Pressable, Text } from 'react-native'

/**
 * A finished sign-in or Registration leaves nothing of the auth screens
 * behind: Back from the next step, or from Home, must not reopen Sign-in
 * for a user who is already signed in.
 */

const copy = { tag: '[test]', title: 'Failed', message: 'Try again.' }

function Register() {
  const { attempt } = useAuthAttempt()
  return (
    <Pressable onPress={() => attempt(() => Promise.resolve(), copy)}>
      <Text>Create account</Text>
    </Pressable>
  )
}

const routes = {
  _layout: () => <Stack />,
  index: () => <Text>Home</Text>,
  'sign-in': () => <Text>Sign in</Text>,
  register: Register,
  'email-opt-in': () => <Text>Email updates</Text>,
  'analytics-consent': () => <Text>Analytics</Text>,
}

it('Registration from Sign-in leaves no auth screen to go back to', async () => {
  await renderRouter(routes, { initialUrl: '/sign-in' })
  await act(async () => {
    router.push('/register')
  })
  await userEvent.setup().press(screen.getByText('Create account'))
  expect(screen.queryByText('Create account')).toBeNull()
  expect(router.canGoBack()).toBe(false)
})
