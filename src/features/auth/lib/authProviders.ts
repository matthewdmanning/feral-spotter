import { FEATURE_FLAGS, type FeatureFlag } from '@/src/shared/config/constants'
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
   * The feature flag that releases this provider. Until it is on, the
   * provider's button renders but its press is blocked (see
   * {@link isFederatedProviderReleased}).
   */
  flag: FeatureFlag
}

export const FEDERATED_PROVIDERS: readonly FederatedProviderConfig[] = [
  { id: 'google', label: authCopy.providerGoogle, flag: 'googleSignIn' },
  { id: 'apple', label: authCopy.providerApple, flag: 'appleSignIn' },
  { id: 'facebook', label: authCopy.providerFacebook, flag: 'facebookSignIn' },
]

/**
 * Whether a provider's feature flag is on, so its button may be pressed.
 * Unreleased providers are shown but blocked.
 */
export function isFederatedProviderReleased(
  provider: FederatedProviderConfig,
  flags: Readonly<Record<FeatureFlag, boolean>> = FEATURE_FLAGS,
): boolean {
  return flags[provider.flag]
}

/**
 * Runtime guard for the sign-in path: throws unless the provider's feature
 * flag is on. Belt-and-suspenders with the disabled sign-in buttons — it
 * keeps the not-yet-verified Apple/Facebook flows from executing, even if
 * reached programmatically.
 */
export function assertFederatedProviderReleased(
  providerId: FederatedProviderId,
): void {
  const cfg = FEDERATED_PROVIDERS.find((p) => p.id === providerId)
  if (cfg && !isFederatedProviderReleased(cfg)) {
    throw new Error(`FEDERATED_PROVIDER_NOT_RELEASED: ${providerId}`)
  }
}
