/**
 * The #93 invariant: auth state is indeterminate until the provider reports
 * once, and every gate keys on `isReady`. A store that turned ready before
 * that first report sent a signed-in user through sign-in and consent again.
 */
import * as auth from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

type Listener = (user: { uid: string } | null) => void

// The listener list lives on the mocked module: jest.mock factories run
// before this file's own top-level code.
jest.mock('@/src/features/auth/lib', () => {
  const listeners: Listener[] = []
  return {
    listeners,
    authProvider: {
      getCurrentUser: () => null,
      onAuthStateChanged: (listener: Listener) => {
        listeners.push(listener)
        return () => {}
      },
    },
  }
})

const report = (user: { uid: string } | null) =>
  (auth as unknown as { listeners: Listener[] }).listeners.forEach((listener) =>
    listener(user),
  )

it('is not ready until the provider first reports, then follows it', () => {
  expect(useAuthStore.getState()).toEqual({ user: null, isReady: false })

  report(null)
  expect(useAuthStore.getState()).toEqual({ user: null, isReady: true })

  report({ uid: 'u1' })
  expect(useAuthStore.getState().user).toEqual({ uid: 'u1' })

  report(null)
  expect(useAuthStore.getState()).toEqual({ user: null, isReady: true })
})
