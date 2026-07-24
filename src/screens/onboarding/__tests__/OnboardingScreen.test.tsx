import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { TUTORIAL_SLIDES } from '@/src/config/onboardingCopy'
import OnboardingScreen from '../index'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
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
    colors: { background: '#fff', text: '#000', muted: '#888', border: '#ccc', accent: '#00f' },
    spacing: { sm: 4, md: 8, lg: 16, xl: 24, xxxl: 40 },
    typography: { sm: 12, base: 16, xxxl: 32 },
    radius: { full: 999 },
  }
  const rt = { insets: { top: 0, bottom: 0 } }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme, rt) : fn) },
  }
})

describe('OnboardingScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the first slide and advances through all of them to /register', async () => {
    render(<OnboardingScreen />)
    expect(screen.getByText(TUTORIAL_SLIDES[0].header)).toBeTruthy()

    for (const slide of TUTORIAL_SLIDES) {
      fireEvent.press(screen.getByText(slide.button))
    }

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/register'))
  })

  it('links to /data-agreement from the data-usage slide', () => {
    render(<OnboardingScreen />)
    // Advance to the data-usage slide (index 2)
    fireEvent.press(screen.getByText(TUTORIAL_SLIDES[0].button))
    fireEvent.press(screen.getByText(TUTORIAL_SLIDES[1].button))

    fireEvent.press(screen.getByRole('link'))
    expect(router.push).toHaveBeenCalledWith('/data-agreement')
  })
})
