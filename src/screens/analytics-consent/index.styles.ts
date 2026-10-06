import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  // Headerless screen (app/_layout.tsx: headerShown: false) — scrollable, so
  // this isn't a hard clip, but insets keep the content off the status bar
  // and gesture bar rather than relying on the fixed xxxl padding alone.
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: rt.insets.top + theme.spacing.xxxl,
    paddingBottom: rt.insets.bottom + theme.spacing.xxxl,
  },
  title: {
    ...theme.textVariants.title,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  body: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },

  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
  },
  analyticsItemText: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    flexShrink: 1,
  },
  itemLabel: { fontWeight: '700' },
  checkbox: {
    width: theme.iconSize.lg,
    height: theme.iconSize.lg,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },

  continueRow: { marginTop: theme.spacing.xxl },
}))
