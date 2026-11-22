// APP_VARIANT=rc marks a build as a release candidate. It sets
// extra.isReleaseCandidate, which src/shared/config/constants.ts reads as
// IS_RELEASE_CANDIDATE. A stable build leaves APP_VARIANT unset. The
// applicationId is deliberately unchanged: google-services.json is bound to it.
const { execSync } = require('node:child_process')
const semver = require('semver')

const isReleaseCandidate = () => process.env.APP_VARIANT === 'rc'

// .github/workflows/release.yml sets APP_VERSION (the release tag) and
// ANDROID_VERSION_CODE (the run number). A local build uses the latest v* tag
// and versionCode 1.
const latestReleaseTag = () => {
  try {
    return execSync('git describe --tags --abbrev=0 --match "v*"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return '0.0.0'
  }
}

const releaseVersion = semver.valid(
  process.env.APP_VERSION ?? latestReleaseTag(),
)
if (!releaseVersion) {
  throw new Error(`APP_VERSION is not SemVer: ${process.env.APP_VERSION}`)
}

module.exports = ({ config }) => ({
  ...config,
  // Launcher label tells a release candidate install apart from a stable one.
  name: isReleaseCandidate() ? `${config.name} (rc)` : config.name,
  // X.Y.Z only: isVersionReleased compares it, and -rc.N would sort below it.
  version: semver.coerce(releaseVersion).version,
  extra: {
    ...config.extra,
    isReleaseCandidate: isReleaseCandidate(),
    posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
    posthogHost: process.env.POSTHOG_HOST,
  },
  android: {
    ...config.android,
    // Full SemVer, e.g. 0.2.1-rc.1, becomes the Gradle versionName.
    version: releaseVersion,
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.ANDROID_GEOLOCATOR,
      },
    },
  },
})
