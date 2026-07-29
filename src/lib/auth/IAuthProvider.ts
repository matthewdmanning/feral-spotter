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
  /** Credential Entry: sign in to an existing email/password account. */
  signInWithEmail(email: string, password: string): Promise<AuthUser>
  /** Registration: create a new email/password account and sign in. */
  registerWithEmail(email: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void
}
