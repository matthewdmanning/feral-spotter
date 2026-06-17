/**
 * babel.config.js — Unistyles 3.0 setup
 *
 * Requires: New Architecture enabled, React Native 0.78+, Expo SDK 53+
 * Run `npx expo prebuild --clean` after adding this plugin.
 */
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-unistyles/plugin', {
        // All files under src/ are processed for StyleSheet dependency detection
        // and component factory ref-borrowing.
        root: 'src',
      }],
    ],
  }
}
