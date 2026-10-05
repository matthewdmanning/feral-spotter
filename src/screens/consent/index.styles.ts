import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxxl,
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
  item: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.md,
    flexShrink: 1,
  },
  itemLabel: { fontWeight: '700' },
  agreeBtn: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
    ...theme.elevation.card,
  },
  agreeText: { ...theme.textVariants.label, color: theme.colors.accentText },
  agreeBusy: { opacity: 0.6 },
  declineBtn: {
    minHeight: theme.controlHeight.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  declineText: {
    ...theme.textVariants.label,
    color: theme.colors.muted,
    textDecorationLine: 'underline',
  },

  gate: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  gateTitle: {
    ...theme.textVariants.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  gateBody: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  gatePrimary: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.xxxl,
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  gatePrimaryText: {
    ...theme.textVariants.label,
    color: theme.colors.accentText,
  },
}))
