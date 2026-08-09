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
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  catRowText: { color: theme.colors.text, fontSize: theme.typography.base },
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
