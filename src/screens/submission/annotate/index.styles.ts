import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    paddingHorizontal: theme.layout.gutter,
    // #187: annotate is a fullScreenModal with headerShown off, edge-to-edge
    // — with no top inset the OS status-bar strip overlapped topRow's
    // content, including the remove-photo button, so touches there hit the
    // status bar instead of the button.
    paddingTop: rt.insets.top + theme.spacing.sm,
    paddingBottom: theme.spacing.md,
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
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  dot: { height: theme.spacing.sm, borderRadius: theme.radius.full },
  carousel: { flex: 1, backgroundColor: theme.colors.background },
  bottomBar: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.md,
    // Mirrors topBar above: with no bottom inset the gesture-navigation bar
    // was drawn over the nav buttons, so touches near the bottom edge hit
    // the system bar instead of the button.
    paddingBottom: rt.insets.bottom + theme.spacing.md,
    zIndex: 2,
  },
  // #375: the reason "← Previous" is disabled.
  disabledReason: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: theme.layout.gutter,
  },
  empty: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.layout.gutter,
  },
  emptyText: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}))
