/**
 * The register screen has no screen test, so this is the only guard on the
 * order and the boundaries of its checks: an off-by-one on the length floor
 * or a swapped order would let a bad form reach the auth provider.
 */

import {
  MIN_PASSWORD_LENGTH,
  validateRegistration,
} from '@/src/shared/utils/validation'

const ok = 'a'.repeat(MIN_PASSWORD_LENGTH)

it.each([
  ['blank email', '   ', ok, ok, 'Missing email'],
  [
    'password one under the floor',
    'a@b.c',
    ok.slice(1),
    ok.slice(1),
    'Weak password',
  ],
  ['mismatched confirm', 'a@b.c', ok, `${ok}x`, 'Passwords do not match'],
  ['email checked before password', '', 'x', 'y', 'Missing email'],
  ['password at the floor', 'a@b.c', ok, ok, null],
])('%s', (_, email, password, confirm, expectedTitle) => {
  expect(validateRegistration(email, password, confirm)?.title ?? null).toBe(
    expectedTitle,
  )
})
