import { useState } from 'react'
import { authCopy, commonCopy, formatCopy } from '@/src/shared/config/text'
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
      showError(commonCopy.error, authCopy.validEmailMessage)
      return
    }
    setBusy(true)
    try {
      await authProvider.changeEmail(address)
      setNewEmail('')
      showSuccess(
        authCopy.checkYourEmailTitle,
        formatCopy(authCopy.emailChangeSentMessage, { email: address }),
      )
    } catch (err) {
      console.error('[settings] change email failed:', err)
      const needsSignIn =
        (err as { code?: string }).code === 'auth/requires-recent-login'
      showError(
        authCopy.changeEmailFailedTitle,
        needsSignIn
          ? authCopy.recentSignInRequiredMessage
          : authCopy.retryMessage,
      )
    } finally {
      setBusy(false)
    }
  }

  return { newEmail, setNewEmail, busy, submit }
}
