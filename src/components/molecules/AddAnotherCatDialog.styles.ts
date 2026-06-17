import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  backdrop:     { flex: 1, backgroundColor: theme.colors.overlay, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xxl },
  frame:        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.xxl, width: '100%', maxWidth: 360, gap: theme.spacing.md },
  title:        { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: '700' },
  body:         { color: theme.colors.muted, fontSize: theme.typography.base, lineHeight: 22 },
  buttons:      { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xs },
  btn:          { flex: 1, borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center' },
  primary:      { backgroundColor: theme.colors.accent },
  primaryText:  { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
  secondary:    { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  secondaryText:{ color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: '600' },
}))
