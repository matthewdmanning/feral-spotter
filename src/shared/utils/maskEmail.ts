/** `jane@example.com` → `j***@example.com`. Shows enough to recognise, not to reuse. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}
