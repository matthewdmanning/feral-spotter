import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  label: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  trigger: {
    minHeight: theme.controlHeight.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  triggerText: { ...theme.textVariants.body, color: theme.colors.text },
  stepRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  stepBtn: {
    minHeight: theme.controlHeight.touchTarget,
    justifyContent: 'center',
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
  },
  stepBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  stepBtnIdle: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  stepTextActive: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.accentText,
  },
  stepTextIdle: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm },
}))
