/**
 * Shared mock for react-native-unistyles.
 *
 * Jest picks this up automatically for every suite, because the real module
 * lives in node_modules and this directory sits next to it. A suite needing
 * different behaviour can still call jest.mock('react-native-unistyles', ...)
 * itself and that wins — src/config/__tests__/themeMode.test.ts does exactly
 * that, since it asserts on what gets passed to StyleSheet.configure.
 *
 * This exists because all 25 suites used to hand-roll their own mock, each
 * covering only the slice of the API its component happened to touch. That is
 * not a mock of the library, it is a mock of current usage, so it breaks the
 * moment a component starts using something else. It did: adding AppButton to
 * ErrorBoundary broke that suite with "styles.useVariants is not a function",
 * and 23 of the 25 had the same gap waiting. One mock of the whole surface
 * removes that class of failure.
 *
 * Plain JavaScript, matching the other mocks here: tsconfig includes every .ts
 * and .tsx outside __tests__, so a .tsx mock lands in the typecheck without
 * jest's globals in scope.
 *
 * Covers everything the app imports — StyleSheet, useUnistyles, withUnistyles,
 * UnistylesRuntime.
 */
const React = require('react')

/** Bottomless stub, so an unknown theme key never throws on property access. */
const anyProp = () => new Proxy({}, { get: () => anyProp() })

/**
 * Real numbers, matching src/config/unistyles.ts. Screens do arithmetic on
 * these — the entrypoint-circle sizing and the Cat Form header zone both derive
 * dimensions from tokens — and a generic stub yields "Cannot convert object to
 * primitive value" instead of a number. Colours stay stubbed: nothing asserts on
 * them, and pinning them here would mean editing this file on every palette
 * change.
 */
const knownTokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  radius: { sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, full: 9999 },
  typography: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 },
}

const theme = new Proxy(knownTokens, {
  get: (target, key) => (key in target ? target[key] : anyProp()),
})

/**
 * Runtime values a stylesheet may read as its second argument — insets, screen
 * size, font scale. Real numbers, for the same reason the tokens are.
 *
 * Insets are deliberately NON-ZERO. They were all 0, which made a style that
 * forgot its inset indistinguishable from one that applied it — every #324
 * safe-area regression passed silently, including the status-bar overlap on
 * Settings and Feral Reports and the gesture-bar overlap on annotate, all
 * three of which shipped and were only caught on a device. These are a Pixel 7
 * in portrait with gesture navigation: 24dp status bar, 24dp gesture inset,
 * and genuinely 0 at the sides.
 */
const rt = {
  insets: { top: 24, bottom: 24, left: 0, right: 0 },
  screen: { width: 390, height: 844 },
  statusBar: { height: 24 },
  navigationBar: { height: 48 },
  fontScale: 1,
  pixelRatio: 3,
  rtl: false,
  themeName: 'dark',
  colorScheme: 'dark',
  hasAdaptiveThemes: true,
}

/**
 * Components declaring variants call styles.useVariants() while rendering.
 * Variants resolve to nothing here — no suite asserts on which variant applied,
 * only that the component renders and behaves.
 */
const withVariants = (styles) =>
  Object.assign(styles, { useVariants: jest.fn() })

const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

const StyleSheet = {
  create: (input) =>
    withVariants(typeof input === 'function' ? input(theme, rt) : input),
  configure: jest.fn(),
  absoluteFill,
  absoluteFillObject: absoluteFill,
  hairlineWidth: 1,
}

const useUnistyles = () => ({ theme, rt })

/** Maps theme to component props; the mapper's output is merged in as props. */
const withUnistyles = (Component, mapper) => {
  const Wrapped = (props) =>
    React.createElement(Component, {
      ...(mapper ? mapper(theme, rt) : {}),
      ...props,
    })
  Wrapped.displayName = `withUnistyles(${Component.displayName ?? Component.name ?? 'Component'})`
  return Wrapped
}

const UnistylesRuntime = {
  ...rt,
  setTheme: jest.fn(),
  setAdaptiveThemes: jest.fn(),
}

const mq = {
  only: { width: jest.fn(), height: jest.fn() },
  width: jest.fn(),
  height: jest.fn(),
}

module.exports = {
  StyleSheet,
  useUnistyles,
  withUnistyles,
  UnistylesRuntime,
  mq,
}
