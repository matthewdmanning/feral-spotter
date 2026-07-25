import { authProvider } from '../index'

describe('dev authProvider stub (__DEV__ is true under jest)', () => {
  it('starts signed out', async () => {
    const cb = jest.fn()
    const unsubscribe = authProvider.onAuthStateChanged(cb)
    expect(cb).toHaveBeenCalledWith(null)
    unsubscribe()
  })

  it('signIn resolves a stub user and notifies subscribers', async () => {
    const cb = jest.fn()
    const unsubscribe = authProvider.onAuthStateChanged(cb)
    cb.mockClear()

    const user = await authProvider.signIn()

    expect(user).toEqual({ uid: 'dev-stub-uid', email: 'dev@feralspotter.local' })
    expect(cb).toHaveBeenCalledWith(user)
    unsubscribe()
  })

  it('getToken rejects when signed out and resolves once signed in', async () => {
    await authProvider.signOut()
    await expect(authProvider.getToken()).rejects.toThrow('NOT_SIGNED_IN')

    await authProvider.signIn()
    await expect(authProvider.getToken()).resolves.toBe('dev-stub-token')
  })

  it('signOut clears the current user and notifies subscribers', async () => {
    await authProvider.signIn()
    const cb = jest.fn()
    const unsubscribe = authProvider.onAuthStateChanged(cb)
    cb.mockClear()

    await authProvider.signOut()

    expect(cb).toHaveBeenCalledWith(null)
    unsubscribe()
  })
})
