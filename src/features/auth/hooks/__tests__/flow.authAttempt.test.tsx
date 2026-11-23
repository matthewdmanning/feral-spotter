import { useAuthAttempt } from '@/src/features/auth/hooks/useAuthAttempt'
import { act, screen, userEvent } from '@testing-library/react-native'
import { Stack, router } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { Pressable, Text } from 'react-native'

/**
 * Flow: Registration from Sign-in
 * A new user on Sign-in taps to register, creates an account, and moves on
 * to the consent steps. Nothing of Sign-in or Registration may remain
 * behind: Back used to reopen Sign-in for a user already signed in.
 *
 * States:
 * - Sign-in: the only screen on the stack.
 * - Registration: pushed above Sign-in; "Create account" shown.
 * - Next step: the first unanswered consent step, or Home; no screen to
 *   go back to.
 * Events: open Registration, tap Create account (sign-up succeeds).
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
