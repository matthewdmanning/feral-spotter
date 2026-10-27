import { StyleSheet } from 'react-native-unistyles'

/**
 * Shows a neighbourhood of pins while leaving the first cards in view. The
 * zoom fit measures the frame, so changing this needs no other edit.
 */
const MAP_HEIGHT = 220

export const styles = StyleSheet.create((theme) => ({
  frame: {
    height: MAP_HEIGHT,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.glass.card,
  },
  map: { flex: 1 },
}))
