import { mockGoogleSignInResponse } from '@react-native-google-signin/google-signin/jest/build/jest/setup'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { getGoogleIdToken, googleSignOut } from '../GoogleSignIn'

describe('GoogleSignIn', () => {
  describe('getGoogleIdToken', () => {
    it('returns the idToken from a successful sign-in', async () => {
      const token = await getGoogleIdToken()
      expect(token).toBe(mockGoogleSignInResponse.data.idToken)
    })

    it('returns null when signIn response has no idToken', async () => {
      jest.spyOn(GoogleSignin, 'signIn').mockResolvedValueOnce({
        type: 'success',
        data: { ...mockGoogleSignInResponse.data, idToken: null },
      } as any)
      const token = await getGoogleIdToken()
      expect(token).toBeNull()
    })
  })

  describe('googleSignOut', () => {
    it('resolves without error', async () => {
      await expect(googleSignOut()).resolves.toBeUndefined()
    })
  })
})
