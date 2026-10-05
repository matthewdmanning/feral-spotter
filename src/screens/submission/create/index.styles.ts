import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  // Header handles the top inset; this screen isn't scrollable, so the last
  // button (Reset) needs the bottom inset itself to clear the gesture bar.
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: rt.insets.bottom + theme.spacing.sm,
    gap: theme.spacing.lg,
  },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  statusRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    padding: theme.spacing.lg,
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
  catList: { gap: theme.spacing.sm },
  catListTitle: {
    ...theme.textVariants.heading,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    padding: theme.spacing.lg,
  },
  catRowText: { ...theme.textVariants.body, flex: 1, color: theme.colors.text },
  // #299: 48x48 hit area, meeting the Material minimum touch target
  // (docs/agents/ui-ux/reference/ux_principles.md) even though the glyph is
  // smaller. Negative vertical margin keeps the taller target from growing
  // the row itself.
  catRowRemoveBtn: {
    width: theme.controlHeight.touchTarget,
    height: theme.controlHeight.touchTarget,
    marginVertical: -theme.spacing.md,
    marginRight: -theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  addCatBtn: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    borderStyle: 'dashed',
  },
  addCatBtnText: { ...theme.textVariants.labelSmall, color: theme.colors.accent },
  addPhotosBtn: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  addPhotosBtnText: { ...theme.textVariants.label, color: theme.colors.text },
  // #375: the reason "Finished!" is disabled.
  disabledReason: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingBottom: theme.spacing.sm,
  },
  doneBtn: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
    ...theme.elevation.card,
  },
  doneBtnText: { ...theme.textVariants.label, color: theme.colors.accentText },
  doneBtnDisabled: { opacity: 0.4 },
  resetBtn: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
  },
  resetBtnText: { ...theme.textVariants.label, color: theme.colors.danger },
}))
