const { withSettingsGradle } = require('expo/config-plugins')

// Pins the CMake every Android module uses, not just :app. The Android Gradle
// plugin defaults to 3.22.1, whose Ninja 1.10 cannot open a path over 260
// characters on Windows and fails with "Filename longer than 260 characters".
// CMake 4.1.2 ships Ninja 1.12, which can. Native libraries such as
// react-native-reanimated and react-native-vision-camera run their own CMake
// build in their own Gradle module, and CMake embeds each source file's
// absolute path in its object path, so a deep project path pushes it over the
// limit. Setting the version in :app alone leaves those modules on 3.22.1.
// Install it with: sdkmanager "cmake;4.1.2"
const CMAKE_VERSION = '4.1.2'
const MARKER = '// withCmakeVersion'

module.exports = function withCmakeVersion(config) {
  return withSettingsGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes(MARKER)) {
      modConfig.modResults.contents += `
${MARKER}
gradle.beforeProject { subproject ->
  ['com.android.library', 'com.android.application'].each { id ->
    subproject.pluginManager.withPlugin(id) {
      subproject.android.externalNativeBuild.cmake.version = "${CMAKE_VERSION}"
    }
  }
}
`
    }
    return modConfig
  })
}
