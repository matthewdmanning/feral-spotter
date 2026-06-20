import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container:    { gap: theme.spacing.sm },
  label:        { fontSize: theme.typography.sm, fontWeight: '500', color: theme.colors.muted },
  row:          { flexDirection: 'row', borderRadius: theme.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  // Base option — combined with selected/idle variant below
  option:       { flex: 1, minHeight: 44, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  optionBorder: { borderRightWidth: 1, borderRightColor: theme.colors.border },

  // Named variants for selected state — applied as array in JSX
  optionSelected: { backgroundColor: theme.colors.accent },
  optionIdle:     { backgroundColor: theme.colors.surface },
  textSelected:   { fontSize: theme.typography.xs, fontWeight: '500', color: theme.colors.accentText },
  textIdle:       { fontSize: theme.typography.xs, fontWeight: '500', color: theme.colors.muted },
}))
