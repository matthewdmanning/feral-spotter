const { mkdir, writeFile } = require('node:fs/promises')
const { join } = require('node:path')
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins')

const resource = 'firebase_emulator_network_security'

module.exports = function withFirebaseEmulatorCleartext(config) {
  const enabled = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
  config = withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    )
    const key = 'android:networkSecurityConfig'
    if (enabled) {
      app.$[key] = `@xml/${resource}`
    } else if (app.$[key] === `@xml/${resource}`) {
      delete app.$[key]
    }
    return config
  })
  if (!enabled) return config

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const directory = join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      )
      await mkdir(directory, { recursive: true })
      await writeFile(
        join(directory, `${resource}.xml`),
        '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<network-security-config>\n' +
          '  <domain-config cleartextTrafficPermitted="true">\n' +
          '    <domain>localhost</domain>\n' +
          '    <domain>127.0.0.1</domain>\n' +
          '    <domain>10.0.2.2</domain>\n' +
          '  </domain-config>\n' +
          '</network-security-config>\n',
      )
      return config
    },
  ])
}
