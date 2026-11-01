import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  // Header handles the top inset; the pinned actions sit below the scroll
  // area, so they need the bottom inset themselves to clear the gesture bar.
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: rt.insets.bottom + theme.spacing.sm,
    gap: theme.layout.sectionGap,
  },
  scroll: { flex: 1 },
  scrollContent: { gap: theme.spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  statusRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.layout.cardPadding,
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusItemText: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.text,
    flexShrink: 1,
  },
  // Same gap between cards as the Reports list.
  catList: { gap: theme.layout.stackGap },
  catListTitle: {
    ...theme.textVariants.heading,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  // One accordion item: the header row and, when open, every field below it.
  // The card has no padding of its own: the header carries it, so the whole
  // header strip — edge to edge — is the tap target, not only the label.
  catCard: {
    borderRadius: theme.radius.xl,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.controlHeight.control,
    paddingHorizontal: theme.layout.cardPadding,
    paddingVertical: theme.spacing.md,
  },
  catRowPressed: { opacity: 0.7 },
  catDetails: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.cardPadding,
    paddingBottom: theme.layout.cardPadding,
  },
  catRowText: { ...theme.textVariants.body, flex: 1, color: theme.colors.text },
  // The actions are a group of their own: 8 + 8 = 16dp above, against 8dp
  // between table rows.
  catActions: { marginTop: theme.spacing.sm },
  // #299: the zero-cats state. Both routes back in are offered here — the
  // secondary one is outlined rather than filled so Annotate still reads as
  // the expected path on a first pass, without blocking the other. No
  // container of its own: catList above already supplies the same gap.
  emptyCatsText: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
  },
  // Full gutter width, like every other screen's actions.
  bottomActions: { gap: theme.layout.stackGap },
  // #375: the reason "Finished!" is disabled.
  disabledReason: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingBottom: theme.spacing.sm,
  },
}))
