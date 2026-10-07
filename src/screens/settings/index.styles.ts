import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
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
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    ...theme.outlined,
    padding: theme.spacing.xl,
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
  linkRow: {
    minHeight: theme.controlHeight.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  // Default color for links with no override (Data Policy); destructive rows
  // pass danger inline.
  linkText: { ...theme.textVariants.label, color: theme.colors.accent },
  hint: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  fieldGroup: { gap: theme.spacing.sm },
  fieldLabel: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  input: {
    ...theme.textVariants.body,
    minHeight: theme.controlHeight.control,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTarget: {
    minWidth: theme.controlHeight.touchTarget,
    minHeight: theme.controlHeight.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextGroup: { flex: 1, gap: 2, paddingRight: theme.spacing.lg },
  toggleLabel: { ...theme.textVariants.label, color: theme.colors.text },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
  },
}))
