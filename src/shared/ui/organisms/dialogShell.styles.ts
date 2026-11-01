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
    paddingHorizontal: theme.layout.gutter,
  },
  sheet: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    // At the largest font size a dialog can outgrow the screen; its body
    // scrolls inside this cap instead of being clipped.
    maxHeight: '90%',
  },
  /** Wraps the sheet's content so it scrolls when it cannot fit. */
  scroll: { flexGrow: 0 },
  scrollContent: { gap: theme.spacing.lg },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
}))
