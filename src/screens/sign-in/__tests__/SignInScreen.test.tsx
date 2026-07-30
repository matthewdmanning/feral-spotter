import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import React from 'react'
import SignInScreen from '../index'

// Pin the app version at/above every provider's release tag so the federated
// buttons are enabled and pressable in this suite. The gate logic itself is
// covered by authProviders.test.ts.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}))

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))

const mockSignInWithEmail = jest.fn()
const mockSignInWithProvider = jest.fn()
jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({
    signInWithEmail: mockSignInWithEmail,
    signInWithProvider: mockSignInWithProvider,
  }),
}))

jest.mock('@/src/components/atoms/AppButton', () => {
  const { Pressable, Text } = require('react-native')
  return {
    AppButton: ({
      onPress,
      children,
      disabled,
    }: {
      onPress: () => void
      children: string
      disabled?: boolean
    }) => (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={children}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  }
})

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: {
      background: '#fff',
      text: '#000',
      muted: '#888',
      surface: '#eee',
      border: '#ccc',
    },
    spacing: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 32, xxxl: 40 },
    radius: { sm: 6, md: 8, lg: 12 },
    typography: { xs: 10, sm: 12, base: 16, xxl: 24 },
  }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

describe('SignInScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('signs in with email/password and navigates on success', async () => {
    mockSignInWithEmail.mockResolvedValueOnce({ uid: '123', email: 'a@b.com' })

    render(<SignInScreen />)
    fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret')
    fireEvent.press(screen.getByLabelText('Sign in'))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/analytics-consent'),
    )
    expect(mockSignInWithEmail).toHaveBeenCalledWith('a@b.com', 'secret')
  })

  it('blocks email sign-in and warns when fields are empty', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    render(<SignInScreen />)
    fireEvent.press(screen.getByLabelText('Sign in'))

    expect(mockSignInWithEmail).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Missing details', expect.any(String))
    alertSpy.mockRestore()
  })

  it('signs in with a federated provider and navigates on success', async () => {
    mockSignInWithProvider.mockResolvedValueOnce({
      uid: '123',
      email: 'a@b.com',
    })

    render(<SignInScreen />)
    fireEvent.press(screen.getByLabelText('Continue with Google'))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/analytics-consent'),
    )
    expect(mockSignInWithProvider).toHaveBeenCalledWith('google')
  })

  it('navigates to registration from the create-account link', () => {
    render(<SignInScreen />)
    fireEvent.press(screen.getByText('Create one'))
    expect(router.push).toHaveBeenCalledWith('/register')
  })

  it('stays on screen and alerts when a sign-in rejects', async () => {
    mockSignInWithProvider.mockRejectedValueOnce(new Error('sign-in failed'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    render(<SignInScreen />)
    fireEvent.press(screen.getByLabelText('Continue with Google'))

    await waitFor(() => expect(mockSignInWithProvider).toHaveBeenCalledTimes(1))
    expect(router.replace).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Sign-in failed', expect.any(String))

    errorSpy.mockRestore()
    alertSpy.mockRestore()
  })
})
