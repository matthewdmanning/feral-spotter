import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  empty:     { color: theme.colors.muted, fontSize: theme.typography.sm },
  strip:     { gap: 10, paddingVertical: 4 },

  // Base thumbnail — opacity + borderColor applied via variant below
  thumb: { width: 80, height: 80, borderRadius: 7, borderWidth: 2 },
  thumbSelected:   { opacity: 1,   borderColor: theme.colors.accent },
  thumbUnselected: { opacity: 0.3, borderColor: theme.colors.surfaceAlt },

  // Check circle
  check: { position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkSelected:   { backgroundColor: theme.colors.accent,  borderColor: theme.colors.accent },
  checkUnselected: { backgroundColor: theme.colors.surface, borderColor: theme.colors.muted },

  dot: { position: 'absolute', bottom: 4, right: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.success },

  // Review button
  reviewBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, borderRadius: theme.radius.md, paddingVertical: theme.spacing.sm, paddingHorizontal: 12, borderWidth: 1 },
  reviewBtnActive:   { backgroundColor: theme.colors.accent,      borderColor: theme.colors.accent },
  reviewBtnReviewed: { backgroundColor: theme.colors.surfaceAlt,  borderColor: theme.colors.border },
  reviewTextActive:   { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '500' },
  reviewTextReviewed: { color: theme.colors.muted,      fontSize: theme.typography.sm, fontWeight: '500' },
}))
