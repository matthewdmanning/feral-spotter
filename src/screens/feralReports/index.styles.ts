import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  // headerShown is forced false for this screen on every path (see
  // index.tsx) — there is no native header to reserve the status-bar
  // space, so the in-body title row needs the inset itself.
  screen: { flex: 1, backgroundColor: theme.colors.background },
  root: { paddingTop: rt.insets.top },
  // One gap between every card, the same as the Cats Recorded list.
  listContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.layout.stackGap,
  },
  // 12dp inside the header; the list gap adds 12dp below it, plus 4dp so the
  // header reads as its own group (16 > 12).
  header: { gap: theme.spacing.md, marginBottom: theme.spacing.xs },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing.md,
  },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  total: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  empty: {
    borderRadius: theme.radius.xl,
    ...theme.glass.card,
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
  // gap, not trailing margins: a wrapped line starts flush with the first.
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: theme.spacing.lg,
    rowGap: theme.spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radius.full,
  },
  legendLabel: { ...theme.textVariants.caption, color: theme.colors.muted },
}))
