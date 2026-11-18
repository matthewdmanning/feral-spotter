/**
 * The register screen has no screen test, so this is the only guard on the
 * order and the boundaries of its checks: an off-by-one on the length floor
 * or a swapped order would let a bad form reach the auth provider. A blank
 * name would create an account that cannot join organizations.
 */

import {
  MIN_PASSWORD_LENGTH,
  validateRegistration,
} from '@/src/shared/utils/validation'

const ok = 'a'.repeat(MIN_PASSWORD_LENGTH)

it.each([
  ['blank name', '  ', 'a@b.c', ok, ok, 'Missing name'],
  ['blank email', 'Cat', '   ', ok, ok, 'Missing email'],
  [
    'password one under the floor',
    'Cat',
    'a@b.c',
    ok.slice(1),
    ok.slice(1),
    'Weak password',
  ],
  [
    'mismatched confirm',
    'Cat',
    'a@b.c',
    ok,
    `${ok}x`,
    'Passwords do not match',
  ],
  ['name checked before email', '', '', 'x', 'y', 'Missing name'],
  ['email checked before password', 'Cat', '', 'x', 'y', 'Missing email'],
  ['password at the floor', 'Cat', 'a@b.c', ok, ok, null],
])('%s', (_, name, email, password, confirm, expectedTitle) => {
  expect(
    validateRegistration(name, email, password, confirm)?.title ?? null,
  ).toBe(expectedTitle)
})
