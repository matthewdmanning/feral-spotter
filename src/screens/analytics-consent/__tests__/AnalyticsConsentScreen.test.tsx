import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import AnalyticsConsentScreen from '../index'
import consentCopy from '@/src/content/consentDisclosure.json'

const mockRouterReplace = jest.fn()
const mockSetAnalyticsAccepted = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    push: jest.fn(),
  },
}))

jest.mock('@/src/hooks/useConsentStore', () => ({
  useConsentStore: (sel: (s: object) => unknown) =>
    sel({
      setAnalyticsAccepted: (...args: unknown[]) =>
        mockSetAnalyticsAccepted(...args),
    }),
}))

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native')
  return { Check: () => <View /> }
})

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: {
      background: '#fff',
      text: '#000',
      muted: '#888',
      border: '#ccc',
      accent: '#00f',
      accentText: '#fff',
      surfaceAlt: '#eee',
      danger: '#f00',
    },
    spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
    typography: { sm: 12, base: 16, xl: 20, xxl: 24 },
    radius: { sm: 4, md: 8, lg: 12 },
  }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

describe('AnalyticsConsentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('toggling the checkbox off then continuing disables analytics and navigates to /(home-tabs)', () => {
    render(<AnalyticsConsentScreen />)

    fireEvent.press(
      screen.getByLabelText(
        `${consentCopy.analytics.label}: ${consentCopy.analytics.text}`,
      ),
    )
    fireEvent.press(screen.getByLabelText(consentCopy.analytics.continueLabel))

    expect(mockSetAnalyticsAccepted).toHaveBeenCalledWith(false)
    expect(mockRouterReplace).toHaveBeenCalledWith('/(home-tabs)')
  })

  it('leaving the checkbox checked (default) and continuing enables analytics and navigates to /(home-tabs)', () => {
    render(<AnalyticsConsentScreen />)

    fireEvent.press(screen.getByLabelText(consentCopy.analytics.continueLabel))

    expect(mockSetAnalyticsAccepted).toHaveBeenCalledWith(true)
    expect(mockRouterReplace).toHaveBeenCalledWith('/(home-tabs)')
  })
})
