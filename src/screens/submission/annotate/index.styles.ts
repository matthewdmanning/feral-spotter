import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    // #187: annotate is a fullScreenModal with headerShown off, edge-to-edge
    // — with no top inset the OS status-bar strip overlapped topRow's
    // content, including the remove-photo button, so touches there hit the
    // status bar instead of the button.
    paddingTop: rt.insets.top + theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    ...theme.elevation.card,
    zIndex: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counter: { ...theme.textVariants.label, color: theme.colors.text },
  removeBtn: {
    width: theme.controlHeight.touchTarget,
    height: theme.controlHeight.touchTarget,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    marginTop: theme.spacing.xs,
  },
  dot: { height: theme.spacing.sm, borderRadius: theme.radius.full },
  carousel: { flex: 1, backgroundColor: theme.colors.background },
  bottomBar: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    // Mirrors topBar above: with no bottom inset the gesture-navigation bar
    // was drawn over the nav buttons, so touches near the bottom edge hit
    // the system bar instead of the button.
    paddingBottom: rt.insets.bottom + theme.spacing.md,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    zIndex: 2,
  },
  // #375: the reason "← Previous" is disabled.
  disabledReason: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  navBtn: {
    minHeight: theme.controlHeight.control,
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimary: { backgroundColor: theme.colors.accent },
  navBtnPrimaryText: {
    ...theme.textVariants.label,
    color: theme.colors.accentText,
    textAlign: 'center',
  },
  navBtnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  navBtnSecondaryText: {
    ...theme.textVariants.label,
    color: theme.colors.text,
    textAlign: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  pillBtn: {
    minHeight: theme.controlHeight.control,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnText: { ...theme.textVariants.labelSmall, color: theme.colors.text },
  empty: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xxl,
  },
  emptyText: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  emptyBtn: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyBtnText: { ...theme.textVariants.label, color: theme.colors.text },
}))
