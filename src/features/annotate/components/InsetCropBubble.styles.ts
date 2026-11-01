import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  wrap: {
    position: 'absolute',
    zIndex: 3,
  },
  wrapTopCenter: {
    // Right-anchored like wrapBottomRight, not flex-centered — collapse now
    // needs a real edge to dock against (2026-08-07). Centering while
    // expanded is done with a computed translateX in the component instead.
    top: 0,
    // Half the standard edge inset: the Cat Form bubble docks tight to the
    // screen edge. The component's centering offset uses the same value.
    right: theme.spacing.md / 2,
  },
  wrapTopRight: {
    // Annotate's expanded dock position (#202 fix — was bottom-right,
    // which the design decision docks top-right instead, see
    // docs/agents/ui-ux/current-state/inset-crop-bubble.md).
    top: 0,
    right: theme.spacing.md,
  },
  bubble: {
    overflow: 'hidden',
    // Rounded square, not the #168 prototype's circular pill (regression
    // fix, #186) — a fixed corner radius, not diameter/2, so it stays a
    // square at any size instead of degenerating into a circle.
    // Corner radius and border width are set by the component, which
    // compensates them for the collapse scale.
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.raised,
  },
  image: {
    position: 'absolute',
  },
}))
