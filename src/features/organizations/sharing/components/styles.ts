import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme, rt) => ({
  content: {
    padding: theme.layout.cardPadding,
    paddingBottom: theme.spacing.xxl + rt.insets.bottom,
    gap: theme.spacing.md,
  },
  map: { height: 300 },
  fill: { flex: 1 },
  photo: { height: 240, width: '100%' },
}))
