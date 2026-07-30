import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: theme.typography.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  input: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.base,
    marginBottom: theme.spacing.md,
  },
  button: { width: '100%', marginTop: theme.spacing.xs },
}))
