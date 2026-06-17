import auth from '@react-native-firebase/auth'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import type { IAuthProvider, AuthUser } from './IAuthProvider'

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
})

export const FirebaseAuthProvider: IAuthProvider = {
  async getToken() {
    const user = auth().currentUser
    if (!user) throw new Error('NOT_AUTHENTICATED')
    return user.getIdToken(false)
  },

  async signIn() {
    await GoogleSignin.hasPlayServices()
    const { idToken } = await GoogleSignin.signIn()
    const credential  = auth.GoogleAuthProvider.credential(idToken)
    const result      = await auth().signInWithCredential(credential)
    return { uid: result.user.uid, email: result.user.email }
  },

  async signOut() {
    await GoogleSignin.signOut()
    await auth().signOut()
  },

  onAuthStateChanged(cb) {
    return auth().onAuthStateChanged(
      (user) => cb(user ? { uid: user.uid, email: user.email } : null),
    )
  },
}
