import { StyleSheet } from 'react-native-unistyles'

/** About half as tall as wide — lib/reports/history.ts's zoom fit assumes it. */
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
