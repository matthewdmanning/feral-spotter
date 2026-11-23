import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.spacing.md },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.controlHeight.touchTarget,
    minWidth: theme.controlHeight.touchTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  reactionSelected: { backgroundColor: theme.colors.selection },
  reactionLabel: { ...theme.textVariants.body, color: theme.colors.text },
  reactionLabelSelected: { color: theme.colors.selectionText },
  comment: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  author: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
}))
