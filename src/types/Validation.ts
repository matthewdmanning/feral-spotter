/**
 * types/Validation.ts
 * Shared validation result shapes for submission/cat form checks.
 */

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}
