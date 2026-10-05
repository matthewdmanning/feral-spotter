import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  base: {
    minHeight: theme.controlHeight.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.accent,
          ...theme.elevation.card,
        },
        secondary: {
          backgroundColor: theme.colors.surface,
          // surface alone barely separates from the root background; the
          // strong border gives the outline enough definition to read as a
          // button.
          borderWidth: 1.5,
          borderColor: theme.colors.borderStrong,
        },
        ghost: { backgroundColor: 'transparent' },
        // Transparent + colored text alone read as a link next to an outlined
        // Cancel. The border makes it read as a subordinate destructive button.
        danger: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.danger,
        },
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
          paddingHorizontal: theme.spacing.lg,
          ...theme.elevation.raised,
        },
      },
    },
  },
  label: {
    ...theme.textVariants.label,
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
  // 0.5 tanked label contrast on the accent background (ux_principles.md
  // contrast minimums) — 0.7 still reads as disabled, stays legible.
  disabled: { opacity: 0.7 },
  // A slight press-in confirms the touch landed before navigation happens.
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}))
