import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  container:            { gap: theme.spacing.sm },
  label:                { fontSize: theme.typography.sm, fontWeight: '500', color: theme.colors.muted },
  trigger:              { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 12 },
  triggerText:          { color: theme.colors.text, fontSize: theme.typography.sm },
  backdrop:             { flex: 1, backgroundColor: theme.colors.overlay, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xxl },
  sheet:                { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xxl, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.xxl, width: '100%', maxWidth: 360, gap: theme.spacing.lg },
  sheetTitle:           { color: theme.colors.text, fontSize: theme.typography.xl, fontWeight: '700' },
  stepRow:              { flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center' },
  stepBtn:              { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.md, borderWidth: 1 },
  stepBtnActive:        { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  stepBtnIdle:          { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
  stepTextActive:       { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '500' },
  stepTextIdle:         { color: theme.colors.muted, fontSize: theme.typography.sm, fontWeight: '500' },
  actionRow:            { flexDirection: 'row', gap: theme.spacing.sm },
  actionBtn:            { flex: 1, borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center' },
  actionBtnPrimary:     { backgroundColor: theme.colors.accent },
  actionBtnPrimaryText: { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
  actionBtnSecondary:   { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  actionBtnSecondaryText:{ color: theme.colors.text, fontSize: theme.typography.sm, fontWeight: '600' },
}))
