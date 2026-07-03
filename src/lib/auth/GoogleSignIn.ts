import { GoogleSignin } from '@react-native-google-signin/google-signin'

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
})

export async function getGoogleIdToken(): Promise<string | null> {
  await GoogleSignin.hasPlayServices()
  const response = await GoogleSignin.signIn()
  return response.data?.idToken ?? null
}

export async function googleSignOut(): Promise<void> {
  await GoogleSignin.signOut()
}
