import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.layout.gutter,
    paddingVertical: theme.spacing.xxxl,
  },
  title: {
    ...theme.textVariants.title,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  agreeRow: { marginTop: theme.spacing.xxl },
  declineBtn: { alignSelf: 'center', marginTop: theme.spacing.sm },
}))
