const { withGradleProperties } = require('expo/config-plugins')

// Restricts the Android build to the Pixel 7's ABI. The generated
// gradle.properties lists all four ABIs, which multiplies native compile time.
// Expo's CLI also passes -PreactNativeArchitectures for a connected device;
// this keeps the restriction when Gradle runs without that flag. For a build
// that needs another ABI, pass -PreactNativeArchitectures=<abi> (it wins).
const PIXEL_7_ABI = 'arm64-v8a'
const KEY = 'reactNativeArchitectures'

module.exports = function withPixel7Architecture(config) {
  return withGradleProperties(config, (modConfig) => {
    modConfig.modResults = modConfig.modResults.filter(
      (item) => !(item.type === 'property' && item.key === KEY),
    )
    modConfig.modResults.push({
      type: 'property',
      key: KEY,
      value: PIXEL_7_ABI,
    })
    return modConfig
  })
}
