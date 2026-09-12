import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  label: {
    fontSize: theme.typography.sm,
    fontWeight: '500',
    color: theme.colors.muted,
  },
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  triggerText: { color: theme.colors.text, fontSize: theme.typography.sm },
  stepRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  stepBtn: {
    minHeight: 48,
    justifyContent: 'center',
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  stepBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  stepBtnIdle: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  stepTextActive: {
    color: theme.colors.accentText,
    fontSize: theme.typography.sm,
    fontWeight: '500',
  },
  stepTextIdle: {
    color: theme.colors.muted,
    fontSize: theme.typography.sm,
    fontWeight: '500',
  },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm },
}))
