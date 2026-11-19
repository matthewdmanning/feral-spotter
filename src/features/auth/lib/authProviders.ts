import { getAppVersion, isVersionReleased } from '@/src/shared/utils/appVersion'
import { authCopy } from '@/src/shared/config/text'

/**
 * The federated identity providers the app can sign in with. Email/password
 * sign-in is deliberately not in this list — it is a separate, non-federated
 * path with its own methods on {@link IAuthProvider}.
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
  { id: 'google', label: authCopy.providerGoogle, releasedInVersion: '0.1.0' },
  { id: 'apple', label: authCopy.providerApple, releasedInVersion: '1.0.0' },
  {
    id: 'facebook',
    label: authCopy.providerFacebook,
    releasedInVersion: '1.0.0',
  },
]

/**
 * Whether a provider's release/version gate has been reached, so its button
 * may be pressed. Unreleased providers are shown but blocked.
 */
export function isFederatedProviderReleased(
  provider: FederatedProviderConfig,
  appVersion: string = getAppVersion(),
): boolean {
  return isVersionReleased(provider.releasedInVersion, appVersion)
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
