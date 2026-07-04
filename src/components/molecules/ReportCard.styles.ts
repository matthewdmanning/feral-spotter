import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card:       { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  row:        { paddingHorizontal: theme.spacing.lg, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  left:       { alignItems: 'center', gap: theme.spacing.xs, minWidth: 52 },
  catCount:   { fontSize: 10, fontWeight: '600', color: theme.colors.muted },
  centre:     { flex: 1, alignItems: 'center' },
  datetime:   { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.text },
  right:      { alignItems: 'flex-end', gap: 2 },
  photoCount: { fontSize: theme.typography.xs, color: theme.colors.muted },
  status:     { fontSize: 11, fontWeight: '600' },
}))
