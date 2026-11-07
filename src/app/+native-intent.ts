/**
 * app/+native-intent.ts
 * Every path the OS opens the app at (a `feralspotter://` link) lands on
 * Home. The consent and sign-in gate runs only there, and every other route
 * assumes it has already passed (and, for submission routes, that a draft
 * exists). No feature links into the app today; add an allowlist here when
 * one does.
 * https://docs.expo.dev/router/advanced/native-intent/
 */

export async function redirectSystemPath(_intent: {
  path: string
  initial: boolean
}): Promise<string> {
  return '/'
}
