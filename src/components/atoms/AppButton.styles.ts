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
          borderWidth: 1,
          borderColor: theme.colors.border,
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
    fontWeight: '600',
    fontSize: theme.typography.sm,
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
  disabled: { opacity: 0.5 },
}))
