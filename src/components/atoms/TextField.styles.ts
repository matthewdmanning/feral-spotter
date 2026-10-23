import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  group: { gap: theme.spacing.sm },
  label: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  input: {
    ...theme.textVariants.body,
    minHeight: theme.controlHeight.control,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
}))
