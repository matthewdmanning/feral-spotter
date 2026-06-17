import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  card:         { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  inner:        { padding: theme.spacing.lg, gap: theme.spacing.lg },
  photoSection: { gap: theme.spacing.sm },
  photoLabel:   { color: theme.colors.muted, fontSize: theme.typography.sm, fontWeight: '500' },
  saveBtn:      { alignItems: 'center', paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.accent },
  saveBtnText:  { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
  doneBtn:      { alignItems: 'center', paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.success },
  doneBtnText:  { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
  disabled:     { opacity: 0.5 },
}))
