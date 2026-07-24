import { render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import * as firstLaunchLib from '@/src/lib/firstLaunch'
import HomeScreen from '../index'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    createStyleSheet: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false, signIn: jest.fn(), signOut: jest.fn() }),
}))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/src/lib/firstLaunch', () => ({
  isFirstLaunch: jest.fn(),
  markLaunched: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))

jest.mock('@/src/components/molecules/SignInPrompt', () => ({
  SignInPrompt: () => null,
}))

jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  Settings: () => null,
}))

describe('HomeScreen first-launch wiring', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to /onboarding on first launch', async () => {
    jest.spyOn(firstLaunchLib, 'isFirstLaunch').mockResolvedValue(true)
    render(<HomeScreen />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'))
  })

  it('does not redirect to /onboarding on subsequent launch', async () => {
    jest.spyOn(firstLaunchLib, 'isFirstLaunch').mockResolvedValue(false)
    render(<HomeScreen />)
    await waitFor(() => expect(router.replace).not.toHaveBeenCalledWith('/onboarding'))
  })
})
