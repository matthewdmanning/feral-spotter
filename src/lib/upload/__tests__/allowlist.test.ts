import { isAllowedEmail, parseAllowlist } from '../allowlist'

describe('parseAllowlist', () => {
  it('splits comma-separated emails and lowercases them', () => {
    const allowlist = parseAllowlist('Tester@Example.com, second@example.com')
    expect(allowlist).toEqual(new Set(['tester@example.com', 'second@example.com']))
  })

  it('drops empty entries from trailing commas/whitespace', () => {
    const allowlist = parseAllowlist('a@example.com, , b@example.com,')
    expect(allowlist).toEqual(new Set(['a@example.com', 'b@example.com']))
  })

  it('returns an empty set when unset', () => {
    expect(parseAllowlist(undefined)).toEqual(new Set())
    expect(parseAllowlist('')).toEqual(new Set())
  })
})

describe('isAllowedEmail', () => {
  const allowlist = parseAllowlist('tester@example.com')

  it('matches case-insensitively', () => {
    expect(isAllowedEmail('Tester@Example.com', allowlist)).toBe(true)
  })

  it('rejects emails not on the list', () => {
    expect(isAllowedEmail('nobody@example.com', allowlist)).toBe(false)
  })
})
