import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  // The bottom padding keeps the action clear of the tab bar.
  container: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.xxl,
  },
  message: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}))
