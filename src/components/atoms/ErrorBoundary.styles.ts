import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg },
  textGroup: { alignItems: 'center', gap: theme.spacing.sm },
  title:     { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700' },
  subtitle:  { color: theme.colors.muted, fontSize: theme.typography.base, textAlign: 'center' },
  card:      { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, maxWidth: 360, width: '100%' },
  cardInner: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  errorLabel:{ color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: '600' },
  errorBox:  { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 12 },
  errorText: { color: theme.colors.muted, fontSize: theme.typography.xs },
  btn:       { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.xxl, paddingVertical: 12 },
  btnText:   { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
}))
