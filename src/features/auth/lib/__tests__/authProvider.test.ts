import { authProvider } from '../index'

describe('dev authProvider stub (__DEV__ is true under jest)', () => {
  it('starts signed out', async () => {
    const cb = jest.fn()
    const unsubscribe = authProvider.onAuthStateChanged(cb)
    expect(cb).toHaveBeenCalledWith(null)
    unsubscribe()
  })

  it('every sign-in path resolves the same stub user and notifies subscribers', async () => {
    const expected = { uid: 'dev-stub-uid', email: 'dev@feralspotter.local' }

    for (const signIn of [
      () => authProvider.signInWithProvider('google'),
      () => authProvider.signInWithEmail('a@b.com', 'pw'),
      () => authProvider.registerWithEmail('a@b.com', 'pw'),
    ]) {
      await authProvider.signOut()
      const cb = jest.fn()
      const unsubscribe = authProvider.onAuthStateChanged(cb)
      cb.mockClear()

      const user = await signIn()

      expect(user).toEqual(expected)
      expect(cb).toHaveBeenCalledWith(expected)
      unsubscribe()
    }
  })

  it('getToken rejects when signed out and resolves once signed in', async () => {
    await authProvider.signOut()
    await expect(authProvider.getToken()).rejects.toThrow('NOT_SIGNED_IN')

    await authProvider.signInWithProvider('google')
    await expect(authProvider.getToken()).resolves.toBe('dev-stub-token')
  })

  it('signOut clears the current user and notifies subscribers', async () => {
    await authProvider.signInWithProvider('google')
    const cb = jest.fn()
    const unsubscribe = authProvider.onAuthStateChanged(cb)
    cb.mockClear()

    await authProvider.signOut()

    expect(cb).toHaveBeenCalledWith(null)
    unsubscribe()
  })
})
