import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme, rt) => ({
  content: {
    padding: theme.layout.cardPadding,
    paddingBottom: theme.spacing.xxl + rt.insets.bottom,
    gap: theme.spacing.md,
  },
}))
