/**
 * components/organisms/dialogShell.styles.ts
 *
 * The centred-dialog shell — backdrop, card, and title — shared by
 * AlertHost and DateTimePickerButton. #328's cluster 2: both declared these
 * byte-identically, and a theme change to one used to miss the other.
 *
 * Values are DateTimePicker's originals, so it is visually unchanged.
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: '700',
  },
}))
