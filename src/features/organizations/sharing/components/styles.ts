import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  content: { padding: theme.layout.cardPadding, gap: theme.spacing.md },
  map: { height: 300 },
  fill: { flex: 1 },
  photo: { height: 240, width: '100%' },
}))
