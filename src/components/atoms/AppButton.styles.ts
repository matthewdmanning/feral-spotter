import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.accent },
        secondary: {
          backgroundColor: theme.colors.surfaceAlt,
          // surfaceAlt sits at ~1.2:1 contrast against the root background —
          // effectively invisible as a fill alone. theme.colors.border is
          // similarly low-contrast (~1.4:1); muted reads at ~7:1, giving the
          // outline enough definition to read as a button.
          borderWidth: 1.5,
          borderColor: theme.colors.muted,
        },
        ghost: { backgroundColor: 'transparent' },
        danger: { backgroundColor: 'transparent' },
      },
      size: {
        default: {},
        // Actual size comes from AppButton's `diameter` prop (screen-dependent,
        // computed by the caller) — borderRadius here is a pre-diameter
        // fallback, overridden once `diameter` is set.
        circle: {
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.md,
        },
      },
    },
  },
  label: {
    fontWeight: '700',
    fontSize: theme.typography.base,
    textAlign: 'center',
    variants: {
      variant: {
        primary: { color: theme.colors.accentText },
        secondary: { color: theme.colors.text },
        ghost: { color: theme.colors.muted },
        danger: { color: theme.colors.danger },
      },
      size: {
        default: {},
      },
    },
  },
  flex1: { flex: 1 },
  // 0.5 tanked label contrast on the accent-blue background (ux_principles.md
  // contrast minimums) — 0.7 still reads as disabled, stays legible.
  disabled: { opacity: 0.7 },
}))
