/**
 * shared/utils/appVersion.ts
 * The running app version and the release-gate check every gated feature
 * shares (federated sign-in providers, the annotation tutorial).
 */
import Constants from 'expo-constants'
import { gte as semverGte, valid as semverValid } from 'semver'

/** The Expo config version, or 0.0.0 when missing or malformed. */
export function getAppVersion(): string {
  const version = Constants.expoConfig?.version
  return semverValid(version ?? '') ? (version as string) : '0.0.0'
}

/**
 * Whether a target version's release/version gate has been reached against
 * the running app version.
 */
export function isVersionReleased(
  targetVersion: string,
  appVersion: string = getAppVersion(),
): boolean {
  return semverGte(appVersion, targetVersion)
}
