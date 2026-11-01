import { maskEmail } from '../maskEmail'

describe('maskEmail', () => {
  it.each([
    ['jane@example.com', 'j***@example.com'],
    ['a@b.co', 'a***@b.co'],
    ['not-an-email', '***'],
    ['@nolocal.com', '***'],
  ])('%s → %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected)
  })
})
