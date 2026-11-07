import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: rt.insets.top + theme.spacing.xxxl,
    paddingBottom: rt.insets.bottom + theme.spacing.lg,
  },
  slideContent: { flex: 1, justifyContent: 'center' },
  header: {
    ...theme.textVariants.display,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  body: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    marginBottom: theme.spacing.md,
  },
  footer: { gap: theme.spacing.lg },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
  },
  // A stretched pill marks the current step by shape as well as color.
  dotActive: {
    width: theme.spacing.xl,
    backgroundColor: theme.colors.highlight,
  },
}))
