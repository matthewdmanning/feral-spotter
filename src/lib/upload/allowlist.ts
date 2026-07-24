/**
 * Tester allowlist gate for the upload API route.
 *
 * Emails are sourced from the TESTER_ALLOWLIST_EMAILS env var (comma-separated),
 * set as a repo/deploy secret rather than hardcoded — see issue #10.
 */

export function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()

  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAllowedEmail(email: string, allowlist: Set<string>): boolean {
  return allowlist.has(email.trim().toLowerCase())
}
