/**
 * Validation utilities for submission data
 */

import type { ValidationError } from '@/src/shared/types'

/**
 * Validates that at least one cat has been observed.
 */
export function validateCatCount(catCount: number): ValidationError[] {
  const errors: ValidationError[] = []

  if (catCount === 0) {
    errors.push({
      field: 'cats',
      message: 'At least one cat observation is required.',
      severity: 'error',
    })
  }

  return errors
}

/**
 * Validates photo requirements
 */
export function validatePhotos(photoCount: number): ValidationError[] {
  const errors: ValidationError[] = []

  if (photoCount === 0) {
    errors.push({
      field: 'photos',
      message: 'At least one photo is required.',
      severity: 'error',
    })
  }

  return errors
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
