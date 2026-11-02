/**
 * shared/lib/appVersion.ts
 * The running app version and the release/version gate built on it. Shared by
 * any feature using the release-gate pattern (federated auth providers, the
 * annotation tutorial, etc.).
 */

import Constants from 'expo-constants'
import { gte as semverGte, valid as semverValid } from 'semver'

/** The running app's version, e.g. "0.1.0", from the bundled app config. */
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
