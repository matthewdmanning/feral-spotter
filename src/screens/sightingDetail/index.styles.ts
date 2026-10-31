import { StyleSheet } from 'react-native-unistyles'

// Mirrors Submission Details' cards, so a past Sighting reads as the same
// record the user built — minus every control.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.gutter,
  },
  content: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.md,
    paddingBottom: rt.insets.bottom + theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerText: { flex: 1 },
  datetime: { ...theme.textVariants.heading, color: theme.colors.text },
  status: { ...theme.textVariants.caption, fontFamily: theme.fonts.bold },
  card: {
    borderRadius: theme.radius.xl,
    padding: theme.layout.cardPadding,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.textVariants.heading,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  catTitle: { ...theme.textVariants.body, color: theme.colors.text, flex: 1 },
  emptyTitle: { ...theme.textVariants.heading, color: theme.colors.text },
  emptyBody: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}))
