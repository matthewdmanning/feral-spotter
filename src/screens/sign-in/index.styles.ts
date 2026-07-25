import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:     { flex: 1, backgroundColor: theme.colors.background },
  content:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.xxl },
  title:    { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700', textAlign: 'center', marginBottom: theme.spacing.xs },
  subtitle: { color: theme.colors.muted, fontSize: theme.typography.sm, textAlign: 'center', marginBottom: theme.spacing.xxxl },
  button:   { width: '100%' },
}))
