import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: {
    borderRadius: theme.radius.xl,
    ...theme.glass.card,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.sm,
  },
  label: { ...theme.textVariants.label, color: theme.colors.text },
  hint: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  row: { gap: theme.spacing.md, paddingTop: theme.spacing.xs },
  option: { position: 'relative' },
  selected: { borderWidth: 3 },
  unselected: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    right: -theme.spacing.xs,
    bottom: -theme.spacing.xs,
    width: theme.iconSize.lg,
    height: theme.iconSize.lg,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
