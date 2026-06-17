export interface AuthUser {
  uid:   string
  email: string | null
}

export interface IAuthProvider {
  getToken():             Promise<string>
  signIn():               Promise<AuthUser>
  signOut():              Promise<void>
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void
}
