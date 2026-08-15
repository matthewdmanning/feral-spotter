import { GoogleSignin } from '@react-native-google-signin/google-signin'

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
})

export interface GoogleTokens {
  idToken: string
  accessToken: string
}

// GoogleSignin.signIn()'s own response only carries idToken (Credential
// Manager migration) — GoogleAuthProvider.credential(idToken) alone crashes
// native-side with "accessToken cannot be empty" (RNFB's Android bridge
// sends the omitted arg as "" rather than null). getTokens() is a second
// call, but it's the only way to get a real accessToken.
export async function getGoogleTokens(): Promise<GoogleTokens | null> {
  await GoogleSignin.hasPlayServices()
  const response = await GoogleSignin.signIn()
  if (!response.data?.idToken) return null
  const { accessToken } = await GoogleSignin.getTokens()
  return { idToken: response.data.idToken, accessToken }
}

export async function googleSignOut(): Promise<void> {
  await GoogleSignin.signOut()
}
