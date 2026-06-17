import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  backdrop:     { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  sheet:        { backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.xxl, borderTopRightRadius: theme.radius.xxl, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.xxl, gap: theme.spacing.lg },
  handle:       { width: 40, height: 5, borderRadius: theme.radius.full, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: theme.spacing.sm },
  title:        { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: '700' },
  body:         { color: theme.colors.muted, fontSize: theme.typography.base, lineHeight: 22 },
  signInBtn:    { backgroundColor: theme.colors.accent, borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center' },
  signInText:   { color: theme.colors.accentText, fontSize: theme.typography.base, fontWeight: '600' },
  laterBtn:     { paddingVertical: 14, alignItems: 'center' },
  laterText:    { color: theme.colors.muted, fontSize: theme.typography.sm, fontWeight: '500' },
  loadingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: 14 },
  loadingText:  { color: theme.colors.muted, fontSize: theme.typography.sm },
}))
