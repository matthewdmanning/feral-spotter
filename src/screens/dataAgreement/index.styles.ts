import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.layout.gutter,
    paddingVertical: theme.spacing.xxxl,
  },
  title: {
    ...theme.textVariants.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
}))
