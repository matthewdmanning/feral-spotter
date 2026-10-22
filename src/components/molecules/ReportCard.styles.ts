import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.xl,
    ...theme.glass.card,
  },
  row: {
    padding: theme.layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  left: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    minWidth: theme.controlHeight.control,
  },
  catCount: { ...theme.textVariants.caption, color: theme.colors.muted },
  // Left-aligned so the date starts at the same edge on every card, rather
  // than floating to wherever its width centres it.
  centre: { flex: 1, alignItems: 'flex-start' },
  datetime: { ...theme.textVariants.labelSmall, color: theme.colors.text },
  right: { alignItems: 'flex-end', gap: theme.spacing.xs },
  photoCount: { ...theme.textVariants.caption, color: theme.colors.muted },
  status: { ...theme.textVariants.caption, fontFamily: theme.fonts.bold },
}))
