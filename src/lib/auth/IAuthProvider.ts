import type { FederatedProviderId } from './authProviders'

export interface AuthUser {
  uid: string
  email: string | null
}

export interface IAuthProvider {
  getToken(): Promise<string>
  getCurrentUser(): AuthUser | null
  /** Federated Sign-In through an external provider portal (Google/Apple/Facebook). */
  signInWithProvider(providerId: FederatedProviderId): Promise<AuthUser>
  /** Sign in to an existing email/password account (non-federated path). */
  signInWithEmail(email: string, password: string): Promise<AuthUser>
  /** Registration: create a new email/password account and sign in. */
  registerWithEmail(email: string, password: string): Promise<AuthUser>
  /**
   * Start an email change. The new address takes effect once the user follows
   * the verification link sent to it. Rejects `auth/requires-recent-login`
   * when the session is too old; the user must sign in again first.
   */
  changeEmail(newEmail: string): Promise<void>
  signOut(): Promise<void>
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void
}
