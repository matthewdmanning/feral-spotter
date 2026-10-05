/**
 * components/organisms/dialogShell.styles.ts
 *
 * The centred-dialog shell — backdrop, card, and title — shared by
 * AlertHost and DateTimePickerButton. #328's cluster 2: both declared these
 * byte-identically, and a theme change to one used to miss the other.
 */

import { StyleSheet } from 'react-native-unistyles'

export const dialogShell = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xxl,
    ...theme.elevation.raised,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.lg,
  },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
}))
