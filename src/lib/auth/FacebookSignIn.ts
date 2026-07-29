import { LoginManager, AccessToken } from 'react-native-fbsdk-next'

/**
 * Runs the native Facebook Login flow and returns the access token used to
 * build a Firebase credential. Throws on user cancellation or a missing token.
 */
export async function getFacebookAccessToken(): Promise<string> {
  const result = await LoginManager.logInWithPermissions([
    'public_profile',
    'email',
  ])
  if (result.isCancelled) throw new Error('FACEBOOK_SIGN_IN_CANCELLED')

  const data = await AccessToken.getCurrentAccessToken()
  if (!data) throw new Error('NO_FACEBOOK_ACCESS_TOKEN')
  return data.accessToken
}

export async function facebookSignOut(): Promise<void> {
  LoginManager.logOut()
}
