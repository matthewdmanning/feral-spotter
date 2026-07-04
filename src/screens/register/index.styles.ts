import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:         { flex: 1, backgroundColor: theme.colors.background },
  scroll:       { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.xxxl },
  title:        { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700', textAlign: 'center', marginBottom: theme.spacing.xs },
  subtitle:     { color: theme.colors.muted, fontSize: theme.typography.sm, textAlign: 'center', marginBottom: theme.spacing.xxl },
  section:      { color: theme.colors.muted, fontSize: theme.typography.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm, marginTop: theme.spacing.lg },
  field:        { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: 13, color: theme.colors.text, fontSize: theme.typography.base, marginBottom: theme.spacing.sm },
  fieldError:   { borderColor: theme.colors.danger },
  errorText:    { color: theme.colors.danger, fontSize: theme.typography.xs, marginBottom: theme.spacing.sm, marginTop: -theme.spacing.xs },
  submitBtn:    { backgroundColor: theme.colors.accent, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.xl },
  submitText:   { color: theme.colors.accentText, fontSize: theme.typography.base, fontWeight: '700' },
  submitBusy:   { opacity: 0.6 },
}))
