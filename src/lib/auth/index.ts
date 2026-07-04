import type { IAuthProvider } from './IAuthProvider'

// Auth provider removed — reimplementing later
export const authProvider: IAuthProvider = {
  getToken: () => Promise.reject(new Error('NOT_IMPLEMENTED')),
  signIn: () => Promise.reject(new Error('NOT_IMPLEMENTED')),
  signOut: () => Promise.reject(new Error('NOT_IMPLEMENTED')),
  onAuthStateChanged: () => () => {},
}
