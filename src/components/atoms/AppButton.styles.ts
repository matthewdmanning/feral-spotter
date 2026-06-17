import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg, paddingVertical: 12,
    variants: {
      variant: {
        primary:   { backgroundColor: theme.colors.accent },
        secondary: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
        ghost:     { backgroundColor: 'transparent' },
        danger:    { backgroundColor: 'transparent' },
      },
    },
  },
  label: {
    fontWeight: '600',
    fontSize: theme.typography.sm,
    variants: {
      variant: {
        primary:   { color: theme.colors.accentText },
        secondary: { color: theme.colors.text },
        ghost:     { color: theme.colors.muted },
        danger:    { color: theme.colors.danger },
      },
    },
  },
  flex1:   { flex: 1 },
  disabled:{ opacity: 0.5 },
}))
