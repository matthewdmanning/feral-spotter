import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:       { flex: 1, backgroundColor: theme.colors.background },
  scroll:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.xxxl },
  title:      { color: theme.colors.text, fontSize: theme.typography.xxl, fontWeight: '700', textAlign: 'center', marginBottom: theme.spacing.lg },
  body:       { color: theme.colors.text, fontSize: theme.typography.base, lineHeight: 22, marginBottom: theme.spacing.md },

  analyticsRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  analyticsItemText:{ color: theme.colors.text, fontSize: theme.typography.base, lineHeight: 22, flexShrink: 1 },
  itemLabel:        { fontWeight: '700' },
  checkbox:         { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked:  { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },

  continueBtn:  { backgroundColor: theme.colors.accent, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.xl },
  continueText: { color: theme.colors.accentText, fontSize: theme.typography.base, fontWeight: '700' },
}))
