import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:        { backgroundColor: theme.colors.background },
  inner:       { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs },
  title:       { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700' },
  total:       { color: theme.colors.muted, fontSize: theme.typography.sm },
  empty:       { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 32, alignItems: 'center', gap: theme.spacing.sm },
  emptyTitle:  { color: theme.colors.muted, fontSize: theme.typography.base },
  emptyBody:   { color: theme.colors.muted, fontSize: theme.typography.sm, textAlign: 'center' },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg, marginBottom: theme.spacing.xs },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: theme.colors.muted, fontSize: theme.typography.xs },
  headerIcon: { marginRight: 4 },
}))
