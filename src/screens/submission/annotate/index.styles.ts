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
    paddingTop: rt.insets.top + 10,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.surfaceAlt,
    zIndex: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counter: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  dot: { height: 7, borderRadius: 4 },
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
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.surfaceAlt,
    zIndex: 2,
  },
  navBtn: {
    minHeight: 48,
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimary: { backgroundColor: theme.colors.accent },
  navBtnPrimaryText: {
    color: theme.colors.accentText,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  navBtnSecondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navBtnSecondaryText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  navBtnDisabled: { opacity: 0.35 },
  pillBtn: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xxl,
  },
  emptyText: { color: theme.colors.muted, fontSize: theme.typography.base },
  emptyBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyBtnText: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
}))
