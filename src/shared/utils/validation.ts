/**
 * Validation utilities for submission data
 */

import { formatCopy, validationCopy } from '@/src/shared/config/text'

/**
 * The #265 hard blocks on sending a draft, as alert lines.
 * Empty when the draft has at least one cat and one photo.
 */
export function missingDraftContent(
  catCount: number,
  photoCount: number,
): string[] {
  return [
    ...(catCount === 0 ? [validationCopy.missingCatObservation] : []),
    ...(photoCount === 0 ? [validationCopy.missingPhoto] : []),
  ]
}

export const MIN_PASSWORD_LENGTH = 6

/** Why a registration form cannot be sent, as alert copy. */
export interface RegistrationProblem {
  title: string
  message: string
}

/**
 * Checks the registration form before it reaches the auth provider.
 * Returns the first problem, or null when the form can be sent.
 */
export function validateRegistration(
  email: string,
  password: string,
  confirm: string,
): RegistrationProblem | null {
  if (!email.trim()) {
    return {
      title: validationCopy.missingEmailTitle,
      message: validationCopy.missingEmailMessage,
    }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      title: validationCopy.weakPasswordTitle,
      message: formatCopy(validationCopy.minimumPasswordLengthMessage, {
        minimumLength: MIN_PASSWORD_LENGTH,
      }),
    }
  }
  if (password !== confirm) {
    return {
      title: validationCopy.passwordsDoNotMatchTitle,
      message: validationCopy.passwordsDoNotMatchMessage,
    }
  }
  return null
}
