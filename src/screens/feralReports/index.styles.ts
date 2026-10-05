import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  // headerShown is forced false for this screen on every path (see
  // index.tsx) — there is no native header to reserve the status-bar
  // space, so the in-body title row needs the inset itself.
  root: { backgroundColor: theme.colors.background, paddingTop: rt.insets.top },
  inner: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: theme.spacing.xs,
  },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  total: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  empty: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xxxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    width: theme.iconSize.xl * 2,
    height: theme.iconSize.xl * 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: { ...theme.textVariants.heading, color: theme.colors.text },
  emptyBody: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },
  legendDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radius.full,
    marginRight: theme.spacing.xs + 2,
  },
  legendLabel: { ...theme.textVariants.caption, color: theme.colors.muted },
  scrollContent: { paddingBottom: theme.spacing.xxxl },
}))
