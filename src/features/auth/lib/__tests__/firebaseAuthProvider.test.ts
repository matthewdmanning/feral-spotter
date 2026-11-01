import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { mockGoogleSignInResponse } from '@react-native-google-signin/google-signin/jest/build/jest/setup'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  verifyBeforeUpdateEmail,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth'
import { createFirebaseAuthProvider } from '../firebaseAuthProvider'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}))

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

const firebaseUser = { uid: 'user-4', email: 'cat@example.com' }

describe('Firebase auth provider', () => {
  it.each([
    {
      method: 'signInWithEmail' as const,
      operation: signInWithEmailAndPassword,
    },
    {
      method: 'registerWithEmail' as const,
      operation: createUserWithEmailAndPassword,
    },
  ])(
    'maps $method results to the public user shape',
    async ({ method, operation }) => {
      jest
        .mocked(operation)
        .mockResolvedValueOnce({ user: firebaseUser } as never)
      const provider = createFirebaseAuthProvider()

      await expect(
        provider[method]('cat@example.com', 'secret'),
      ).resolves.toEqual({
        uid: 'user-4',
        email: 'cat@example.com',
      })
      expect(operation).toHaveBeenCalledWith(
        getAuth(),
        'cat@example.com',
        'secret',
      )
    },
  )

  it('exchanges both Google tokens for a Firebase session in a released build', async () => {
    const credential = { providerId: 'google.com', token: 'credential' }
    jest
      .mocked(GoogleAuthProvider.credential)
      .mockReturnValueOnce(credential as never)
    jest
      .mocked(signInWithCredential)
      .mockResolvedValueOnce({ user: firebaseUser } as never)

    await expect(
      createFirebaseAuthProvider().signInWithProvider('google'),
    ).resolves.toEqual(firebaseUser)

    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
      mockGoogleSignInResponse.data.idToken,
      'mockAccessToken',
    )
    expect(signInWithCredential).toHaveBeenCalledWith(getAuth(), credential)
  })

  it('still clears the Firebase session when federated SDK sign-out fails', async () => {
    jest
      .spyOn(GoogleSignin, 'signOut')
      .mockRejectedValueOnce(new Error('native logout failed'))
    jest.mocked(firebaseSignOut).mockResolvedValueOnce(undefined)

    await expect(
      createFirebaseAuthProvider().signOut(),
    ).resolves.toBeUndefined()

    expect(firebaseSignOut).toHaveBeenCalledTimes(1)
    expect(firebaseSignOut).toHaveBeenCalledWith(getAuth())
  })

  it('changeEmail asks Firebase to verify the new address first', async () => {
    jest.mocked(getAuth).mockReturnValueOnce({
      currentUser: firebaseUser,
    } as never)

    await createFirebaseAuthProvider().changeEmail('new@example.com')

    expect(verifyBeforeUpdateEmail).toHaveBeenCalledWith(
      firebaseUser,
      'new@example.com',
    )
  })

  it('changeEmail rejects when signed out', async () => {
    await expect(
      createFirebaseAuthProvider().changeEmail('new@example.com'),
    ).rejects.toThrow('NOT_SIGNED_IN')
  })

  it('propagates Firebase sign-out failure so callers cannot report success', async () => {
    const failure = new Error('Firebase session could not be cleared')
    jest.mocked(firebaseSignOut).mockRejectedValueOnce(failure)

    await expect(createFirebaseAuthProvider().signOut()).rejects.toBe(failure)
    expect(firebaseSignOut).toHaveBeenCalledWith(getAuth())
  })
})
