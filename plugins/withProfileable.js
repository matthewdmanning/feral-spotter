const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins')

// Lets the Android Studio profiler and Perfetto attach to release builds, and
// turns on the camera view's trace sections and timing logs. Inactive unless
// the build is prebuilt with PROFILEABLE_BUILD=1, so production builds carry
// neither. Prebuild with --clean to remove it again.
module.exports = (config) => {
  if (process.env.PROFILEABLE_BUILD !== '1') return config
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    )
    application.profileable = [{ $: { 'android:shell': 'true' } }]
    return config
  })
}
