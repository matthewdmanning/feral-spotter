import type { EmailListProvider } from './EmailListProvider'

interface VerifiedToken {
  email?: string
  email_verified?: boolean
}

export interface EmailSubscriptionRequest {
  authorization: string | undefined
  body: unknown
}

/**
 * Opt the signed-in user's own address in or out. The address comes from the
 * verified ID token, never from the request, so a caller cannot subscribe
 * anyone else.
 */
export async function setEmailSubscription(
  { authorization, body }: EmailSubscriptionRequest,
  provider: EmailListProvider,
  verifyIdToken: (token: string) => Promise<VerifiedToken>,
): Promise<{ status: number }> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1]
  const subscribed = (body as { subscribed?: unknown } | null)?.subscribed
  if (!token) return { status: 401 }
  if (typeof subscribed !== 'boolean') return { status: 400 }

  let claims: VerifiedToken
  try {
    claims = await verifyIdToken(token)
  } catch {
    return { status: 401 }
  }
  if (!claims.email) return { status: 400 }

  if (subscribed) {
    await provider.subscribe(claims.email, {
      emailVerified: claims.email_verified === true,
    })
  } else {
    // Verified or not: an account has exactly one address, so the token's
    // address is the caller's own list entry. An unverified opt-out must
    // land, or a later confirmation of the earlier `pending` signup would
    // subscribe someone who opted out. This only stops email; it never
    // deletes the account.
    await provider.unsubscribe(claims.email)
  }
  return { status: 204 }
}
