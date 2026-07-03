import auth from '@react-native-firebase/auth'
import type { IAuthProvider, AuthUser } from './IAuthProvider'

export const FirebaseAuthProvider: IAuthProvider = {
  async getToken() {
    const user = auth().currentUser
    if (!user) throw new Error('NOT_AUTHENTICATED')
    return user.getIdToken(false)
  },

  async signIn() {
    throw new Error('NOT_IMPLEMENTED')
  },

  async signOut() {
    await auth().signOut()
  },

  onAuthStateChanged(cb) {
    return auth().onAuthStateChanged(
      (user) => cb(user ? { uid: user.uid, email: user.email } : null),
    )
  },
}
