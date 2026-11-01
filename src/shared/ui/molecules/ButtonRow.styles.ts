import { StyleSheet } from 'react-native-unistyles'

// One gap for rows and stacks alike: layout.stackGap (12dp), the same gap as
// BottomButtonColumn, so a row that stacks keeps its rhythm.
export const styles = StyleSheet.create((theme) => ({
  row: {
    gap: theme.layout.stackGap,
    variants: {
      stacked: {
        true: { flexDirection: 'column' },
        false: { flexDirection: 'row' },
      },
    },
  },
  cell: {
    variants: {
      stacked: {
        true: {},
        false: { flex: 1 },
      },
    },
  },
}))
