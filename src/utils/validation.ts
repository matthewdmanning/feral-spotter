/**
 * Validation utilities for submission data
 * Fix #6: Improved validation that allows "unknown"/"unsure" values
 */

import type { ValidationError, ValidationResult } from '@/src/types'

/**
 * Structural subsets of ObservedCat/SubmissionDraft (src/hooks/useSubmissionStore) —
 * defined locally so utils/ stays free of a hooks/ dependency.
 */
export interface ValidatableCat {
  age?: string
  ear_tipped?: string
  owned_domesticated?: string
  pattern?: string
  hair_length?: string
  color?: string
  sex?: string
}

export interface ValidatableSubmission {
  location_type?: string
  time_type?: string
  address?: string
  latitude?: number
  longitude?: number
}

/**
 * Validates a single cat observation
 */
export function validateCat(cat: ValidatableCat, index: number = 0): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = index > 0 ? `Cat ${index + 1}: ` : ''
  
  // Only check for missing/empty values, "unknown"/"unsure" are valid
  if (!cat.age || cat.age === '') {
    errors.push({
      field: `cats.${index}.age`,
      message: `${prefix}Age is required.`,
      severity: 'error',
    })
  }
  
  if (!cat.ear_tipped || cat.ear_tipped === '') {
    errors.push({
      field: `cats.${index}.ear_tipped`,
      message: `${prefix}Ear-tip status is required.`,
      severity: 'error',
    })
  }
  
  if (!cat.owned_domesticated || cat.owned_domesticated === '') {
    errors.push({
      field: `cats.${index}.owned_domesticated`,
      message: `${prefix}Ownership status is required.`,
      severity: 'error',
    })
  }
  
  if (!cat.pattern || cat.pattern === '') {
    errors.push({
      field: `cats.${index}.pattern`,
      message: `${prefix}Pattern is required.`,
      severity: 'error',
    })
  }
  
  if (!cat.hair_length || cat.hair_length === '') {
    errors.push({
      field: `cats.${index}.hair_length`,
      message: `${prefix}Hair length is required.`,
      severity: 'error',
    })
  }
  
  if (!cat.color || cat.color === '') {
    errors.push({
      field: `cats.${index}.color`,
      message: `${prefix}Color is required.`,
      severity: 'error',
    })
  }
  
  if (!cat.sex || cat.sex === '') {
    errors.push({
      field: `cats.${index}.sex`,
      message: `${prefix}Sex is required.`,
      severity: 'error',
    })
  }
  
  return errors
}

/**
 * Validates the submission metadata
 */
export function validateSubmission(
  submission: ValidatableSubmission
): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!submission.location_type) {
    errors.push({
      field: 'location_type',
      message: 'Location type is required.',
      severity: 'error',
    })
  }
  
  if (!submission.time_type) {
    errors.push({
      field: 'time_type',
      message: 'Time type is required.',
      severity: 'error',
    })
  }
  
  // Validate location data based on type
  if (submission.location_type === 'pin' || submission.location_type === 'device') {
    if (submission.latitude === undefined || submission.longitude === undefined) {
      errors.push({
        field: 'location',
        message: 'GPS coordinates are required for this location type.',
        severity: 'error',
      })
    }
  }
  
  if (submission.location_type === 'address') {
    if (!submission.address || submission.address.trim() === '') {
      errors.push({
        field: 'address',
        message: 'Address is required when using manual address entry.',
        severity: 'error',
      })
    }
  }
  
  return errors
}

/**
 * Validates the complete submission (metadata + cats)
 */
export function validateCompleteSubmission(
  submission: ValidatableSubmission,
  cats: ValidatableCat[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  
  // Validate submission metadata
  errors.push(...validateSubmission(submission))
  
  // Validate at least one cat
  if (cats.length === 0) {
    errors.push({
      field: 'cats',
      message: 'At least one cat observation is required.',
      severity: 'error',
    })
  }
  
  // Validate each cat
  cats.forEach((cat, index) => {
    errors.push(...validateCat(cat, index))
  })
  
  // Add warnings for "unknown"/"unsure" values (informational only)
  cats.forEach((cat, index) => {
    if (cat.sex === 'unknown') {
      warnings.push({
        field: `cats.${index}.sex`,
        message: `Cat ${index + 1}: Sex is unknown (this is OK, but try to observe if possible)`,
        severity: 'warning',
      })
    }
    
    if (cat.pattern === 'unknown') {
      warnings.push({
        field: `cats.${index}.pattern`,
        message: `Cat ${index + 1}: Pattern is unknown (this is OK)`,
        severity: 'warning',
      })
    }
  })
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
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

/**
 * Validates that all photos are uploaded before submission
 */
export function validatePhotosUploaded(
  uploadedCount: number,
  totalCount: number
): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (uploadedCount < totalCount) {
    errors.push({
      field: 'photos',
      message: `${totalCount - uploadedCount} photo(s) still need to be uploaded.`,
      severity: 'error',
    })
  }
  
  return errors
}
