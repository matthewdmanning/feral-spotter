import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  root:          { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg },
  header:        { gap: theme.spacing.sm, marginTop: theme.spacing.lg, marginBottom: theme.spacing.lg },
  title:         { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700' },
  subtitle:      { color: theme.colors.muted, fontSize: theme.typography.base },
  list:          { gap: theme.spacing.sm },
  card:          { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  cardBody:      { padding: theme.spacing.lg, gap: theme.spacing.sm },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between' },
  catCount:      { color: theme.colors.text, fontSize: theme.typography.lg, fontWeight: '700' },
  date:          { color: theme.colors.muted, fontSize: theme.typography.sm },
  location:      { color: theme.colors.text, fontSize: theme.typography.base },
  submittedRow:  { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  submittedText: { color: theme.colors.success, fontSize: theme.typography.sm },
  empty:         { padding: theme.spacing.lg, alignItems: 'center', paddingVertical: 40, gap: theme.spacing.sm },
  emptyText:     { color: theme.colors.muted, fontSize: theme.typography.xl },
  emptySubtext:  { color: theme.colors.muted, fontSize: theme.typography.base, textAlign: 'center' },
}))
