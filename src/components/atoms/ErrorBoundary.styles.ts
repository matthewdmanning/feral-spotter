import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  textGroup: { alignItems: 'center', gap: theme.spacing.sm },
  title: {
    ...theme.textVariants.title,
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  card: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    maxWidth: 360,
    width: '100%',
  },
  cardInner: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  errorLabel: { ...theme.textVariants.labelSmall, color: theme.colors.text },
  errorBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.textVariants.caption, color: theme.colors.muted },
}))
