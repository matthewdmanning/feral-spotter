import { StyleSheet } from 'react-native-unistyles'

// No styles needed — layout uses runtime width/height (inline),
// and Skia <Rect>/<Paint> colors are read via useUnistyles() in the
// component since they are component props, not style props.
export const styles = StyleSheet.create(() => ({}))
