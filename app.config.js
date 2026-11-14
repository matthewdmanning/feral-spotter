// APP_VARIANT=prerelease marks a build as a pre-release (see
// scripts/build-prerelease.sh). It sets extra.isPrerelease, which
// src/shared/config/constants.ts reads as IS_PRERELEASE. The applicationId is
// deliberately unchanged: google-services.json is bound to it.
const isPrerelease = () => process.env.APP_VARIANT === 'prerelease'

module.exports = ({ config }) => ({
  ...config,
  // Launcher label tells a pre-release install apart from a release one.
  name: isPrerelease() ? `${config.name} (pre)` : config.name,
  extra: {
    ...config.extra,
    isPrerelease: isPrerelease(),
    posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
    posthogHost: process.env.POSTHOG_HOST,
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.ANDROID_GEOLOCATOR,
      },
    },
  },
})
