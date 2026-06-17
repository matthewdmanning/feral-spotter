import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  root:          { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  title:         { color: theme.colors.text, fontSize: theme.typography.xxxl, fontWeight: '700' },
  card:          { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing.lg, gap: theme.spacing.lg },
  fieldGroup:    { gap: theme.spacing.sm },
  fieldLabel:    { color: theme.colors.muted, fontSize: theme.typography.sm, fontWeight: '500' },
  input:         { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 8, color: theme.colors.text, fontSize: theme.typography.sm },
  footerGroup:   { gap: theme.spacing.sm },
  saveIndicator: { fontSize: theme.typography.xs, color: theme.colors.muted, textAlign: 'right' },
  continueBtn:   { alignItems: 'center', paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.accent },
  continueBtnText:{ color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
  catList:       { gap: theme.spacing.sm },
  catListTitle:  { color: theme.colors.text, fontSize: theme.typography.base, fontWeight: '600' },
  catRow:        { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing.lg },
  catRowText:    { color: theme.colors.text, fontSize: theme.typography.base },
}))
