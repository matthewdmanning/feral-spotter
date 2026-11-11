import { StyleSheet as RNStyleSheet } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme, rt) => ({
  card: {
    padding: theme.layout.cardPadding,
    gap: theme.layout.sectionGap,
    borderRadius: theme.radius.xl,
  },
  summary: { gap: theme.spacing.xs },
  itemTitle: { ...theme.textVariants.label, color: theme.colors.text },
  header: { gap: theme.spacing.xs },
  group: { gap: theme.spacing.sm },
  groupTitle: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  fieldDetail: {
    paddingStart: theme.controlSize.checkbox + theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  section: {
    borderTopWidth: RNStyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  footer: {
    borderTopWidth: RNStyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
  body: { ...theme.textVariants.body, color: theme.colors.text, flexShrink: 1 },
  hint: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    flexShrink: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    minHeight: theme.controlHeight.touchTarget,
    paddingVertical: theme.spacing.sm,
  },
  checkLabel: { ...theme.textVariants.body, color: theme.colors.text, flex: 1 },
  checkbox: {
    marginTop:
      (theme.textVariants.body.lineHeight * rt.fontScale -
        theme.controlSize.checkbox) /
      2,
    flexShrink: 0,
    width: theme.controlSize.checkbox,
    height: theme.controlSize.checkbox,
    borderWidth: theme.borderWidth.control,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
}))
