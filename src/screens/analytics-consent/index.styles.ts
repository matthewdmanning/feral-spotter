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
    color: theme.colors.text,
    fontSize: theme.typography.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  body: {
    color: theme.colors.text,
    fontSize: theme.typography.base,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },

  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  analyticsItemText: {
    color: theme.colors.text,
    fontSize: theme.typography.base,
    lineHeight: 22,
    flexShrink: 1,
  },
  itemLabel: { fontWeight: '700' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },

  continueBtn: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  continueText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.base,
    fontWeight: '700',
  },
}))
