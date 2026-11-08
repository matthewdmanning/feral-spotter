import { useState } from 'react'
import { showError, showSuccess } from '@/src/shared/hooks/useUIStore'
import { authProvider } from '@/src/features/auth/lib'

const LOOKS_LIKE_EMAIL = /^\S+@\S+\.\S+$/

/** Settings' change-email form: the address takes effect after the emailed link. */
export function useChangeEmail() {
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const address = newEmail.trim()
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      showError('Error', 'Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      await authProvider.changeEmail(address)
      setNewEmail('')
      showSuccess(
        'Check your email',
        `We sent a link to ${address}. Your email changes once you follow it.`,
      )
    } catch (err) {
      console.error('[settings] change email failed:', err)
      const needsSignIn =
        (err as { code?: string }).code === 'auth/requires-recent-login'
      showError(
        'Could not change email',
        needsSignIn
          ? 'Sign out and sign in again, then try once more.'
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return { newEmail, setNewEmail, busy, submit }
}
