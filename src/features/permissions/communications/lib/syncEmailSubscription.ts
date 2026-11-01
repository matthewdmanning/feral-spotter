import { EMAIL_SYNC_URL } from '@/src/shared/config/constants'
import { authProvider } from '@/src/features/auth/lib'

/**
 * Tell the backend to subscribe or unsubscribe the signed-in user's address.
 * The backend picks the mailing-list service and reads the address from the ID
 * token, so the app holds no service key and names no address.
 */
export async function syncEmailSubscription(
  subscribed: boolean,
): Promise<void> {
  if (!EMAIL_SYNC_URL) return
  const response = await fetch(EMAIL_SYNC_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await authProvider.getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscribed }),
  })
  if (!response.ok) {
    throw new Error(`Email sync responded ${response.status}`)
  }
}
