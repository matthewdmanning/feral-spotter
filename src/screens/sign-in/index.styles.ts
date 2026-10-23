import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  // Headerless screen (app/_layout.tsx: headerShown: false) — content sits
  // directly under the status bar and above the gesture bar without these.
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.layout.gutter,
  },
  title: {
    ...theme.textVariants.display,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  fields: { gap: theme.spacing.md },
  button: { width: '100%', marginTop: theme.spacing.lg },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  registerText: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xxl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: {
    ...theme.textVariants.caption,
    color: theme.colors.muted,
    marginHorizontal: theme.spacing.md,
  },
  providerButton: { width: '100%', marginBottom: theme.spacing.md },
}))
