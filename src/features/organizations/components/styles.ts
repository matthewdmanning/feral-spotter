import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  card: {
    padding: theme.layout.cardPadding,
    gap: theme.layout.stackGap,
    borderRadius: theme.radius.xl,
  },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
  subtitle: { ...theme.textVariants.label, color: theme.colors.text },
  body: { ...theme.textVariants.body, color: theme.colors.text, flexShrink: 1 },
  hint: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    flexShrink: 1,
  },
  // Inside a card: tighter than the card's own gap, so a group reads as one.
  permissionGroup: { gap: theme.spacing.sm },
  fieldGroup: { gap: theme.spacing.sm },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.layout.stackGap,
    minHeight: theme.controlHeight.touchTarget,
    paddingVertical: theme.spacing.sm,
  },
}))
