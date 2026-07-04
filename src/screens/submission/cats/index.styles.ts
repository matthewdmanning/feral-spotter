import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  scroll:        { backgroundColor: theme.colors.background },
  inner:         { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:         { color: theme.colors.text, fontSize: theme.typography.xxxl, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerBtn:     { paddingVertical: 4, paddingHorizontal: 8 },
  headerBtnText: { fontSize: theme.typography.sm, fontWeight: '500' },
  divider:       { width: 1, height: 16, backgroundColor: theme.colors.border },
}))
