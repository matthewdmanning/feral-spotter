const { withMainActivity } = require('expo/config-plugins')
const {
  mergeContents,
} = require('@expo/config-plugins/build/utils/generateCode')

// Records a Hermes sampling profile of the first seconds of a cold start.
// Inactive unless the build is prebuilt with HERMES_STARTUP_PROFILE=1, so
// normal builds never carry it. Capture with
// emulator_tools/hermes_startup_profile.sh.
const PROFILE_SECONDS = 6

module.exports = (config) => {
  if (process.env.HERMES_STARTUP_PROFILE !== '1') return config
  return withMainActivity(config, (config) => {
    config.modResults.contents = mergeContents({
      tag: 'hermes-startup-profiler',
      src: config.modResults.contents,
      newSrc: `    com.facebook.hermes.instrumentation.HermesSamplingProfiler.enable()
    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
      val profile = java.io.File(getExternalFilesDir(null), "hermes-startup.json")
      com.facebook.hermes.instrumentation.HermesSamplingProfiler.dumpSampledTraceToFile(profile.path)
      com.facebook.hermes.instrumentation.HermesSamplingProfiler.disable()
    }, ${PROFILE_SECONDS * 1000}L)`,
      anchor: /super\.onCreate\(/,
      offset: 0,
      comment: '//',
    }).contents
    return config
  })
}
