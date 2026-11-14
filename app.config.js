// APP_VARIANT=rc marks a build as a release candidate (see
// scripts/build-release.sh). It sets extra.isReleaseCandidate, which
// src/shared/config/constants.ts reads as IS_RELEASE_CANDIDATE. A stable build
// leaves APP_VARIANT unset. The applicationId is deliberately unchanged:
// google-services.json is bound to it.
const isReleaseCandidate = () => process.env.APP_VARIANT === 'rc'

module.exports = ({ config }) => ({
  ...config,
  // Launcher label tells a release candidate install apart from a stable one.
  name: isReleaseCandidate() ? `${config.name} (rc)` : config.name,
  extra: {
    ...config.extra,
    isReleaseCandidate: isReleaseCandidate(),
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
