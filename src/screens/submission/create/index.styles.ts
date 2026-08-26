import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xxxl,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statusItemText: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: '500',
  },
  catList: { gap: theme.spacing.sm },
  catListTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  catRowText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.base,
  },
  // #299: 48x48 hit area, meeting the Material minimum touch target
  // (docs/references/ux_principles.md) even though the glyph is 18px. Negative
  // vertical margin keeps the taller target from growing the row itself.
  catRowRemoveBtn: {
    width: 48,
    height: 48,
    marginVertical: -12,
    marginRight: -theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // #299: the zero-cats state. Both routes back in are offered here — the
  // secondary one is outlined rather than filled so Annotate still reads as
  // the expected path on a first pass, without blocking the other. No
  // container of its own: catList above already supplies the same gap.
  emptyCatsText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
  },
  describeCatBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  describeCatBtnText: {
    color: theme.colors.text,
    fontSize: theme.typography.base,
    fontWeight: '600',
  },
  addCatBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addCatBtnText: {
    color: theme.colors.accent,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  addPhotosBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addPhotosBtnText: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  doneBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  doneBtnText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  doneBtnDisabled: { opacity: 0.4 },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  resetBtnText: {
    color: theme.colors.danger,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
}))
