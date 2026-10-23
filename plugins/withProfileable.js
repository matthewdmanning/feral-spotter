const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins')

// Lets the Android Studio profiler and Perfetto attach to release builds.
module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    )
    application.profileable = [{ $: { 'android:shell': 'true' } }]
    return config
  })
