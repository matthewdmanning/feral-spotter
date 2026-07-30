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
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  registerText: { color: theme.colors.muted, fontSize: theme.typography.sm },
  registerLink: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xxl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: {
    color: theme.colors.muted,
    fontSize: theme.typography.xs,
    marginHorizontal: theme.spacing.md,
  },
  providerButton: { width: '100%', marginBottom: theme.spacing.md },
}))
