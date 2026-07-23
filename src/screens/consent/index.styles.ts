import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:       { flex: 1, backgroundColor: theme.colors.background },
  scroll:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.xxxl },
  title:      { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700', textAlign: 'center', marginBottom: theme.spacing.lg },
  body:       { color: theme.colors.text, fontSize: theme.typography.base, lineHeight: 22, marginBottom: theme.spacing.md },
  item:       { color: theme.colors.text, fontSize: theme.typography.base, lineHeight: 22, marginBottom: theme.spacing.xs, marginLeft: theme.spacing.md },
  itemLabel:  { fontWeight: '700' },
  agreeBtn:   { backgroundColor: theme.colors.accent, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.xl },
  agreeText:  { color: theme.colors.accentText, fontSize: theme.typography.base, fontWeight: '700' },
  agreeBusy:  { opacity: 0.6 },

  gate:             { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  gateTitle:        { color: theme.colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  gateBody:         { color: theme.colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  gatePrimary:      { backgroundColor: theme.colors.accent, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginTop: 8 },
  gatePrimaryText:  { color: theme.colors.accentText, fontSize: 15, fontWeight: '600' },
  gateSecondary:    { backgroundColor: theme.colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  gateSecondaryText:{ color: theme.colors.text, fontSize: 15, fontWeight: '600' },
}))
