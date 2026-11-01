import * as ui from '@/src/shared/hooks/useUIStore'
import {
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { router } from 'expo-router'

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

describe('SignInScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('signs in with email/password and navigates on success', async () => {
    mockSignInWithEmail.mockResolvedValueOnce({ uid: '123', email: 'a@b.com' })

    render(<SignInScreen />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.press(screen.getByLabelText('Sign in'))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/email-opt-in'),
    )
    expect(mockSignInWithEmail).toHaveBeenCalledWith('a@b.com', 'secret')
  })

  it('blocks email sign-in and warns when fields are empty', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})

    render(<SignInScreen />)
    await userEvent.press(screen.getByLabelText('Sign in'))

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
    await userEvent.press(screen.getByLabelText('Continue with Google'))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/email-opt-in'),
    )
    expect(mockSignInWithProvider).toHaveBeenCalledWith('google')
  })

  it('navigates to registration from the create-account link', async () => {
    render(<SignInScreen />)
    await userEvent.press(screen.getByText('Create one'))
    expect(router.push).toHaveBeenCalledWith('/register')
  })

  it('stays on screen and alerts when a sign-in rejects', async () => {
    mockSignInWithProvider.mockRejectedValueOnce(new Error('sign-in failed'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})

    render(<SignInScreen />)
    await userEvent.press(screen.getByLabelText('Continue with Google'))

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Sign-in failed',
        expect.any(String),
      ),
    )
    expect(mockSignInWithProvider).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Sign-in failed', expect.any(String))

    errorSpy.mockRestore()
    alertSpy.mockRestore()
  })
})
