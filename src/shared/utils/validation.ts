/**
 * Validation utilities for submission data
 */

/**
 * The #265 hard blocks on sending a draft, as alert lines.
 * Empty when the draft has at least one cat and one photo.
 */
export function missingDraftContent(
  catCount: number,
  photoCount: number,
): string[] {
  return [
    ...(catCount === 0 ? ['At least one cat observation is required.'] : []),
    ...(photoCount === 0 ? ['At least one photo is required.'] : []),
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
    return { title: 'Missing email', message: 'Enter an email address.' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      title: 'Weak password',
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }
  if (password !== confirm) {
    return {
      title: 'Passwords do not match',
      message: 'Re-enter the same password in both fields.',
    }
  }
  return null
}
