import { useState } from 'react'
import { authCopy, commonCopy, formatCopy } from '@/src/shared/config/text'
import { showError, showSuccess } from '@/src/shared/hooks/useUIStore'
import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

const LOOKS_LIKE_EMAIL = /^\S+@\S+\.\S+$/

/** Settings' change-email form: the address takes effect after the emailed link. */
export function useChangeEmail() {
  const user = useAuthStore((s) => s.user)
  const [emailOwnerUid, setEmailOwnerUid] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [dismissedUid, setDismissedUid] = useState<string | null>(null)
  const newEmail = user?.uid === emailOwnerUid ? emailDraft : ''
  const promptOpen = Boolean(user && !user.email && dismissedUid !== user.uid)

  /** Use this function to keep the typed address value scoped to the current account uid. */
  const setNewEmail = (value: string) => {
    if (!user) return
    setEmailOwnerUid(user.uid)
    setEmailDraft(value)
  }

  /** Use this function to open the prompt; it depends on the current account and request state. */
  const openPrompt = () => {
    if (!user || user.email || busy) return
    setDismissedUid(null)
  }

  /** Use this function to close the prompt; it depends on the current account. */
  const closePrompt = () => {
    if (user) setDismissedUid(user.uid)
  }

  const submit = async () => {
    const address = newEmail.trim()
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      showError(commonCopy.error, authCopy.validEmailMessage)
      return
    }
    setBusy(true)
    try {
      await authProvider.changeEmail(address)
      setEmailDraft('')
      closePrompt()
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

  return {
    newEmail,
    setNewEmail,
    busy,
    submit,
    promptOpen,
    openPrompt,
    closePrompt,
  }
}
