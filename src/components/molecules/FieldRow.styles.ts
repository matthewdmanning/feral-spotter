import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  label: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  // Shrinks and wraps, so a long value (an address) never pushes its label
  // off the card.
  value: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
}))
