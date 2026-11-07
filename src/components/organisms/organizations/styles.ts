import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  card: {
    padding: theme.layout.cardPadding,
    gap: theme.spacing.md,
    marginVertical: theme.spacing.md,
  },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  body: { ...theme.textVariants.body, color: theme.colors.text, flexShrink: 1 },
  hint: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    flexShrink: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 48,
    paddingVertical: theme.spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  mark: { color: theme.colors.background, fontWeight: 'bold' },
}))
