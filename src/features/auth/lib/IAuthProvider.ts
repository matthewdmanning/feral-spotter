import type { FederatedProviderId } from './authProviders'

export interface AuthUser {
  uid: string
  email: string | null
  /** Account profile name: from the federated provider, or entered at email Registration. */
  displayName?: string | null
}

/** How the signed-in account proves who it is: a password or a provider. */
export type SignInMethod = 'password' | FederatedProviderId

export interface IAuthProvider {
  /** `forceRefresh` fetches a new token, e.g. to carry a fresh sign-in time. */
  getToken(forceRefresh?: boolean): Promise<string>
  getCurrentUser(): AuthUser | null
  /** Federated Sign-In through an external provider portal (Google/Apple/Facebook). */
  signInWithProvider(providerId: FederatedProviderId): Promise<AuthUser>
  /** Sign in to an existing email/password account (non-federated path). */
  signInWithEmail(email: string, password: string): Promise<AuthUser>
  /** Registration: create a new email/password account with its name, and sign in. */
  registerWithEmail(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AuthUser>
  /**
   * Start an email change. The new address takes effect once the user follows
   * the verification link sent to it. Rejects `auth/requires-recent-login`
   * when the session is too old; the user must sign in again first.
   */
  changeEmail(newEmail: string): Promise<void>
  /** The signed-in account's sign-in method; null when signed out or unknown. */
  signInMethod(): SignInMethod | null
  /**
   * Prove the signed-in user's identity again, for security-sensitive steps
   * such as account deletion. A provider account opens its sign-in sheet; a
   * password account needs `password`. Rejects 'SIGN_IN_CANCELLED' when the
   * user dismisses the sheet.
   */
  reauthenticate(password?: string): Promise<void>
  signOut(): Promise<void>
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void
}
