import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  message: { ...theme.textVariants.body, color: theme.colors.muted },
  buttonRow: { flexDirection: 'row', gap: theme.spacing.sm },
  buttonColumn: { gap: theme.spacing.sm },
}))
