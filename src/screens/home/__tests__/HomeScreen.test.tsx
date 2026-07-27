import { render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { useAuth } from '@/src/lib/auth/useAuth'
import { hasAcceptedConsent } from '@/src/hooks/useConsentStore'
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
  useAuth: jest.fn(),
}))

jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: jest.fn(),
}))

jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))

jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  Settings: () => null,
}))

describe('HomeScreen app-wide gate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to /intro-flow when unauthenticated', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isReady: true, signIn: jest.fn(), signOut: jest.fn() })
    ;(hasAcceptedConsent as jest.Mock).mockReturnValue(false)

    render(<HomeScreen />)

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/intro-flow'))
  })

  it('redirects to /consent when authenticated but device consent not accepted', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isReady: true, signIn: jest.fn(), signOut: jest.fn() })
    ;(hasAcceptedConsent as jest.Mock).mockReturnValue(false)

    render(<HomeScreen />)

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/consent'))
  })

  it('does not redirect when authenticated and device consent accepted', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isReady: true, signIn: jest.fn(), signOut: jest.fn() })
    ;(hasAcceptedConsent as jest.Mock).mockReturnValue(true)

    render(<HomeScreen />)

    expect(router.replace).not.toHaveBeenCalled()
  })

  it('does not redirect while auth state is not yet ready', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isReady: false, signIn: jest.fn(), signOut: jest.fn() })
    ;(hasAcceptedConsent as jest.Mock).mockReturnValue(false)

    render(<HomeScreen />)

    expect(router.replace).not.toHaveBeenCalled()
  })
})
