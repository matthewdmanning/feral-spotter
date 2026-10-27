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
  // The star badge hangs past each crop's bottom-right corner by `xs`; the
  // horizontal ScrollView clips its content, so the row pads to keep it in.
  row: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
  },
  option: { position: 'relative' },
  selected: { borderWidth: theme.borderWidth.selected },
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
