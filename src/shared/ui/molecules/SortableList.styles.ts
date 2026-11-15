import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.layout.stackGap },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  // Above its siblings, so the lifted row is never drawn under the one it passes.
  activeRow: { zIndex: 1 },
  content: { flex: 1 },
  handle: {
    minWidth: theme.controlHeight.touchTarget,
    minHeight: theme.controlHeight.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
