import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  message: { ...theme.textVariants.body, color: theme.colors.muted },
  buttonColumn: { gap: theme.layout.stackGap },
}))
