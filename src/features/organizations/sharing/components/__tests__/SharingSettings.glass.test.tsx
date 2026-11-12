import { act, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { organizationCopy } from '@/src/shared/config/text'
import { SharingSettings } from '@/src/features/organizations/sharing/components/SharingSettings'

test.each([false, true])(
  'sharing card preserves GlassSurface native and fallback props (reduced=%s)',
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

    await render(<SharingSettings />)
    await waitFor(() => expect(accessibility).toHaveBeenCalled())
    await act(async () => {})

    const theme = UnistylesRuntime.getTheme()
    const card = screen.getByText(organizationCopy.sharingSettings.title).parent
    expect(card).toBeTruthy()
    expect(card).toHaveStyle({
      padding: theme.layout.cardPadding,
      borderRadius: theme.radius.xl,
    })
    if (reduced) {
      expect(card).toHaveStyle({ backgroundColor: theme.colors.surface })
      expect(card?.props.tintColor).toBeUndefined()
    } else {
      expect(card?.props.tintColor).toBe(theme.glass.card)
      expect(card?.props.glassCornerRadius).toBe(theme.radius.xl)
      expect(
        StyleSheet.flatten(card?.props.style).backgroundColor,
      ).toBeUndefined()
    }
  },
)
