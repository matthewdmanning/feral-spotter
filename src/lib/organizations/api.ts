import { useAuthStore } from '@/src/lib/auth/authStore'
import { authProvider } from '@/src/lib/auth'

const API_URL = process.env.EXPO_PUBLIC_ORGANIZATIONS_API_URL
export class OrganizationSyncError extends Error {
  constructor(readonly requiresConfirmation: boolean) {
    super('Organization permissions could not sync')
  }
}
/** Never transmits credentials to a caller-supplied address. */
export async function organizationRequest<T>(
  body: Record<string, unknown>,
  expectedUid = useAuthStore.getState().user?.uid,
): Promise<T> {
  if (!API_URL) throw new Error('Organization service is not configured')
  if (!expectedUid || useAuthStore.getState().user?.uid !== expectedUid)
    throw new Error('Account changed')
  const token = await authProvider.getToken()
  if (useAuthStore.getState().user?.uid !== expectedUid)
    throw new Error('Account changed')
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (useAuthStore.getState().user?.uid !== expectedUid)
    throw new Error('Account changed')
  if (!response.ok) throw new OrganizationSyncError(response.status === 409)
  return response.json() as Promise<T>
}
