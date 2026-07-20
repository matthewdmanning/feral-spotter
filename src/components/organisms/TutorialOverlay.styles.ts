import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  backdrop:    { flex: 1, backgroundColor: theme.colors.overlay, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: theme.spacing.xxl, paddingBottom: 100 },
  skipBtn:     { position: 'absolute', top: 56, right: theme.spacing.xxl, paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md },
  skipText:    { color: theme.colors.muted, fontSize: theme.typography.sm, fontWeight: '600' },
  card:        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.xxl, width: '100%', maxWidth: 360, gap: theme.spacing.md },
  counter:     { color: theme.colors.muted, fontSize: theme.typography.xs, fontWeight: '600' },
  title:       { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: '700' },
  body:        { color: theme.colors.muted, fontSize: theme.typography.base, lineHeight: 22 },
  primary:     { backgroundColor: theme.colors.accent, borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center', marginTop: theme.spacing.xs },
  primaryText: { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
}))
