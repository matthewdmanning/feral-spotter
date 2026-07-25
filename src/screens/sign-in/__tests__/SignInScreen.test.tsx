import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import SignInScreen from '../index'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))

const mockSignIn = jest.fn()
jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}))

jest.mock('@/src/components/atoms/AppButton', () => {
  const { Pressable, Text } = require('react-native')
  return {
    AppButton: ({ onPress, children }: { onPress: () => void; children: string }) => (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={children}>
        <Text>{children}</Text>
      </Pressable>
    ),
  }
})

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: { background: '#fff', text: '#000', muted: '#888' },
    spacing: { xs: 2, xxl: 32, xxxl: 40 },
    typography: { sm: 12, xxl: 24 },
  }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

describe('SignInScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('signs in with Google and navigates to /profile on success', async () => {
    mockSignIn.mockResolvedValueOnce({ uid: '123', email: 'a@b.com' })

    render(<SignInScreen />)
    fireEvent.press(screen.getByLabelText('Sign in with Google'))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/profile'))
    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })

  it('stays on screen and does not navigate when signIn rejects', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('sign-in failed'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(<SignInScreen />)
    fireEvent.press(screen.getByLabelText('Sign in with Google'))

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1))
    expect(router.replace).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
