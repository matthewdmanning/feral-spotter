import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
  },
  inner: { padding: theme.spacing.xl, gap: theme.spacing.xl },
  section: { gap: theme.spacing.md },
  actions: { gap: theme.spacing.md },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.controlHeight.control,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
  },
  saveBtnText: { ...theme.textVariants.label, color: theme.colors.accentText },
}))
