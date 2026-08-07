import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  inner: { padding: theme.spacing.lg, gap: theme.spacing.xl },
  section: { gap: theme.spacing.md },
  actions: { gap: theme.spacing.md },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  saveBtnText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
}))
