import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1 },
  content: {
    padding: theme.layout.gutter,
    paddingBottom: theme.layout.sectionGap + rt.insets.bottom,
    gap: theme.layout.sectionGap,
  },
  // Pinned below the scrolling list; owns the bottom safe area itself.
  footer: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.layout.stackGap,
    paddingBottom: theme.layout.gutter + rt.insets.bottom,
  },
}))
