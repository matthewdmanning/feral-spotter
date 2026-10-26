import type { EmailListConfig, EmailListProvider } from './EmailListProvider'

// https://emailoctopus.com/api-documentation/v2 — "Create or update contact"
const API_BASE = 'https://api.emailoctopus.com'

export function createEmailOctopusProvider(
  { apiKey, listId }: EmailListConfig,
  fetchImpl: typeof fetch = fetch,
): EmailListProvider {
  // PUT is an upsert, so subscribe and unsubscribe are the same call.
  const putContact = async (
    email: string,
    status: 'pending' | 'subscribed' | 'unsubscribed',
  ) => {
    const response = await fetchImpl(`${API_BASE}/lists/${listId}/contacts`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email_address: email, status }),
    })
    if (!response.ok) {
      throw new Error(`EmailOctopus responded ${response.status}`)
    }
  }

  return {
    // 'pending' makes EmailOctopus send its own confirmation email.
    subscribe: (email, { emailVerified }) =>
      putContact(email, emailVerified ? 'subscribed' : 'pending'),
    unsubscribe: (email) => putContact(email, 'unsubscribed'),
  }
}
