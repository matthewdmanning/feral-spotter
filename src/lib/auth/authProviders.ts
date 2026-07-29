import Constants from 'expo-constants'
import { gte as semverGte, valid as semverValid } from 'semver'

/**
 * The federated identity providers the app can sign in with. Credential Entry
 * (email + password) is deliberately not in this list — it is a separate,
 * non-federated path with its own methods on {@link IAuthProvider}.
 */
export type FederatedProviderId = 'google' | 'apple' | 'facebook'

export interface FederatedProviderConfig {
  id: FederatedProviderId
  /** Button label, e.g. "Continue with Google". */
  label: string
  /**
   * The app version at which this provider goes live. A provider is only
   * usable once the running app's version is >= this tag; until then its
   * button renders but its press is blocked (see {@link isFederatedProviderReleased}).
   * This is the release/version gate: flip a provider on by shipping the app
   * version that also carries its completed Console + native setup.
   */
  releasedInVersion: string
}

/**
 * Google is live as of the current line; Apple and Facebook are fully wired in
 * code but gated to a future release because their Firebase Console providers
 * and native credentials (Apple Services ID, Facebook App ID) are not yet
 * provisioned. See docs for the external-setup checklist that must ship with
 * the 1.0.0 build before these are unblocked.
 */
export const FEDERATED_PROVIDERS: readonly FederatedProviderConfig[] = [
  { id: 'google', label: 'Continue with Google', releasedInVersion: '0.1.0' },
  { id: 'apple', label: 'Continue with Apple', releasedInVersion: '1.0.0' },
  {
    id: 'facebook',
    label: 'Continue with Facebook',
    releasedInVersion: '1.0.0',
  },
]

/** The running app's version, e.g. "0.1.0", from the bundled app config. */
export function getAppVersion(): string {
  const version = Constants.expoConfig?.version
  return semverValid(version ?? '') ? (version as string) : '0.0.0'
}

/**
 * Whether a provider's release/version gate has been reached, so its button
 * may be pressed. Unreleased providers are shown but blocked.
 */
export function isFederatedProviderReleased(
  provider: FederatedProviderConfig,
  appVersion: string = getAppVersion(),
): boolean {
  return semverGte(appVersion, provider.releasedInVersion)
}

/**
 * Runtime guard for the sign-in path: throws unless the provider's release/
 * version gate is met. Belt-and-suspenders with the disabled sign-in buttons —
 * it keeps the not-yet-verified Apple/Facebook flows from executing in a build
 * that hasn't reached their release, even if reached programmatically.
 */
export function assertFederatedProviderReleased(
  providerId: FederatedProviderId,
): void {
  const cfg = FEDERATED_PROVIDERS.find((p) => p.id === providerId)
  if (cfg && !isFederatedProviderReleased(cfg)) {
    throw new Error(`FEDERATED_PROVIDER_NOT_RELEASED: ${providerId}`)
  }
}
