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
        large: {
          flex: 1,
          flexDirection: 'column',
          gap: theme.spacing.md,
          borderRadius: theme.radius.xl,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.xl,
        },
      },
    },
  },
  label: {
    fontWeight: '600',
    fontSize: theme.typography.sm,
    variants: {
      variant: {
        primary: { color: theme.colors.accentText },
        secondary: { color: theme.colors.text },
        ghost: { color: theme.colors.muted },
        danger: { color: theme.colors.danger },
      },
      size: {
        default: {},
        large: { fontSize: theme.typography.xl, fontWeight: '700' },
      },
    },
  },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
}))
