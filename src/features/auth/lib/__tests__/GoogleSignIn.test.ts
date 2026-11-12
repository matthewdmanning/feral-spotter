import { mockGoogleSignInResponse } from '@react-native-google-signin/google-signin/jest/build/jest/setup'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import {
  getGoogleTokens,
  googleSignOut,
} from '@/src/features/auth/lib/GoogleSignIn'

describe('GoogleSignIn', () => {
  describe('getGoogleTokens', () => {
    it('returns both idToken and accessToken from a successful sign-in', async () => {
      const tokens = await getGoogleTokens()
      expect(tokens).toEqual({
        idToken: mockGoogleSignInResponse.data.idToken,
        accessToken: 'mockAccessToken',
      })
    })

    it('returns null when signIn response has no idToken', async () => {
      jest.spyOn(GoogleSignin, 'signIn').mockResolvedValueOnce({
        type: 'success',
        data: { ...mockGoogleSignInResponse.data, idToken: null },
      } as any)
      const tokens = await getGoogleTokens()
      expect(tokens).toBeNull()
    })
  })

  describe('googleSignOut', () => {
    it('invokes SDK sign-out and propagates its failure', async () => {
      const failure = new Error('provider sign-out failed')
      const signOut = jest
        .spyOn(GoogleSignin, 'signOut')
        .mockRejectedValueOnce(failure)

      await expect(googleSignOut()).rejects.toBe(failure)
      expect(signOut).toHaveBeenCalledTimes(1)
    })
  })
})
