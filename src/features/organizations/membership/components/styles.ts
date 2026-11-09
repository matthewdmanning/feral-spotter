import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.layout.cardPadding,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
}))
