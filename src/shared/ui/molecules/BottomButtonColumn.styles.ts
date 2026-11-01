import { StyleSheet } from 'react-native-unistyles'

// Only the stack itself. Button appearance comes from AppButton.
export const styles = StyleSheet.create((theme) => ({
  container: {
    width: '100%',
    gap: theme.layout.stackGap,
    paddingBottom: theme.spacing.lg,
  },
}))
