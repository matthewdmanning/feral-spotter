import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    ...theme.outlined,
  },
  row: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  left: { alignItems: 'center', gap: theme.spacing.xs, minWidth: 52 },
  catCount: { ...theme.textVariants.caption, color: theme.colors.muted },
  // Left-aligned so the date starts at the same edge on every card, rather
  // than floating to wherever its width centres it.
  centre: { flex: 1, alignItems: 'flex-start' },
  datetime: { ...theme.textVariants.labelSmall, color: theme.colors.text },
  right: { alignItems: 'flex-end', gap: 2 },
  photoCount: { ...theme.textVariants.caption, color: theme.colors.muted },
  status: { ...theme.textVariants.caption, fontWeight: '700' },
}))
