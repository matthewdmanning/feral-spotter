const { withAppBuildGradle } = require('expo/config-plugins')

// Pins the CMake the Android build uses. The Android Gradle plugin defaults to
// 3.22.1, whose Ninja 1.10 cannot open a path over 260 characters on Windows
// and fails with "Filename longer than 260 characters". CMake 4.1.2 ships
// Ninja 1.12, which can. react-native-gesture-handler compiles a source from
// outside its CMake folder, so CMake embeds that file's absolute path in the
// object path and a deep project path pushes it over the limit.
// Install it with: sdkmanager "cmake;4.1.2"
const CMAKE_VERSION = '4.1.2'
const MARKER = '// withCmakeVersion'

module.exports = function withCmakeVersion(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes(MARKER)) {
      modConfig.modResults.contents += `
${MARKER}
android {
    externalNativeBuild {
        cmake {
            version "${CMAKE_VERSION}"
        }
    }
}
`
    }
    return modConfig
  })
}
