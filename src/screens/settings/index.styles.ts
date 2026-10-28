import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: rt.insets.top,
  },
  scroll: { flex: 1 },
  // maxWidth keeps line length readable once there is room to stretch: past the
  // md breakpoint the cards stop widening and centre instead. Tracer for the
  // breakpoint convention documented in config/unistyles.ts.
  inner: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
    alignSelf: 'center',
    maxWidth: { xs: '100%', md: 640 },
  },
  header: { gap: theme.spacing.xs, marginTop: theme.spacing.lg },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  subtitle: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  card: {
    borderRadius: theme.radius.xl,
    ...theme.glass.card,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.md,
  },
  cardTitle: { ...theme.textVariants.heading, color: theme.colors.text },
  gap: { gap: theme.spacing.sm },
  configuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  configuredText: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.accentSoftText,
  },
  hint: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  // The card gap (12) plus this margin puts 16dp on each side of a divider.
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
  },
}))
