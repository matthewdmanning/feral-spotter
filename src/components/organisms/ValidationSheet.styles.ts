import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  sheet:       { zIndex: 999 },
  content:     { padding: theme.spacing.xl, gap: theme.spacing.lg, paddingBottom: 36 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  title:       { color: theme.colors.text, fontSize: 22, fontWeight: '700', flex: 1 },
  subtitle:    { color: theme.colors.muted, fontSize: theme.typography.base },
  errorList:   { gap: 10 },
  errorCard:   { borderRadius: theme.radius.lg, borderWidth: 1, padding: 14 },
  cardError:   { backgroundColor: '#2A1515', borderColor: theme.colors.danger },
  cardWarn:    { backgroundColor: '#2A2510', borderColor: theme.colors.warning },
  errorText:   { color: theme.colors.text, fontSize: theme.typography.base },
  closeBtn:    { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: theme.spacing.xs },
  closeBtnText:{ color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: '600' },
}))
