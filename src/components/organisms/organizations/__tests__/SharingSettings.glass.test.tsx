import { act, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { useOrganizationSharingStore } from '@/src/hooks/useOrganizationSharingStore'
import { SharingSettings } from '../SharingSettings'

// A card-local solid fill or a missing radius can hide or square the native
// glass even when the shared GlassSurface itself works correctly.
test.each([false, true])(
  'sharing card preserves native glass and its accessibility fallback (reduced=%s)',
  async (reduced) => {
    jest.replaceProperty(Platform, 'OS', 'android')
    const accessibility = jest
      .spyOn(AccessibilityInfo, 'isHighTextContrastEnabled')
      .mockResolvedValue(reduced)
    useAuthStore.setState({
      user: { uid: 'observer', email: 'observer@example.test' },
      isReady: true,
    })
    useOrganizationsFlag.setState({ enabled: true })
    useOrganizationSharingStore.setState({ accounts: {}, hydrated: true })
    render(<SharingSettings />)
    await waitFor(() => expect(accessibility).toHaveBeenCalled())
    await act(async () => {})

    const theme = UnistylesRuntime.getTheme()
    const card = screen.getByTestId('organization-sharing-settings')
    expect(card).toHaveStyle({
      padding: theme.layout.cardPadding,
      borderRadius: theme.radius.xl,
    })
    if (reduced) {
      expect(card).toHaveStyle({ backgroundColor: theme.colors.surface })
      expect(card.props.tintColor).toBeUndefined()
    } else {
      expect(card.props.tintColor).toBe(theme.glass.card)
      expect(card.props.glassCornerRadius).toBe(theme.radius.xl)
      expect(
        StyleSheet.flatten(card.props.style).backgroundColor,
      ).toBeUndefined()
    }
  },
)
