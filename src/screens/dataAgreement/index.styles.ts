import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:      { flex: 1, backgroundColor: theme.colors.background },
  scroll:    { flexGrow: 1, paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.xxxl },
  title:     { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700', marginBottom: theme.spacing.lg },
  body:      { color: theme.colors.text, fontSize: theme.typography.base, lineHeight: 22, marginBottom: theme.spacing.md },
  item:      { color: theme.colors.text, fontSize: theme.typography.base, lineHeight: 22, marginBottom: theme.spacing.xs, marginLeft: theme.spacing.md },
  itemLabel: { fontWeight: '700' },
}))
