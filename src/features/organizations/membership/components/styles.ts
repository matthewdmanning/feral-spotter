import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme, rt) => ({
  content: {
    padding: theme.layout.gutter,
    paddingBottom: theme.layout.sectionGap + rt.insets.bottom,
    gap: theme.layout.sectionGap,
  },
}))
