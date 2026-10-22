// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')

// Expo tree shaking removes unused exports from production bundles. Without it
// a release build carries every icon in lucide-react-native's barrel (1,752 of
// 4,293 modules) and runs them all at start-up. Expo CLI reads both flags
// after it loads this file, so setting them here covers `expo export`, `expo
// run` and the embedded release bundle alike. An explicit `0` in the
// environment still turns them off. Development bundles are unaffected: Expo
// applies them in production mode only.
// https://docs.expo.dev/guides/tree-shaking/
process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH ??= '1'
process.env.EXPO_UNSTABLE_TREE_SHAKING ??= '1'

const config = getDefaultConfig(__dirname)

// Inline requires defer each module until its first use, so start-up runs only
// what the first screen needs. Expo advises it only together with tree
// shaking, because on its own it can reorder import side effects — so it is
// limited to production bundles, the only ones tree shaking touches.
config.transformer.getTransformOptions = async (_entryPoints, { dev }) => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: !dev,
  },
})

module.exports = config
