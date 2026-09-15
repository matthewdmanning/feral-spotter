/**
 * Validation utilities for submission data
 */

import type { ValidationError } from '@/src/types'

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
