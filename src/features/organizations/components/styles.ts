import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  card: {
    padding: theme.layout.cardPadding,
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
  },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
  body: { ...theme.textVariants.body, color: theme.colors.text, flexShrink: 1 },
  hint: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    flexShrink: 1,
  },
  fieldGroup: { gap: theme.spacing.sm },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 48,
    paddingVertical: theme.spacing.sm,
  },
}))
