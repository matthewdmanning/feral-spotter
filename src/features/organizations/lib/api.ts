import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { authProvider } from '@/src/features/auth/lib'

export class OrganizationSyncError extends Error {
  constructor(readonly status: number) {
    super('Organization permissions could not sync')
  }
  /** 409: the user must review and confirm again. */
  get requiresConfirmation(): boolean {
    return this.status === 409
  }
}

function assertAccount(expectedUid: string | undefined) {
  if (!expectedUid || useAuthStore.getState().user?.uid !== expectedUid)
    throw new Error('Account changed')
}

/** Never transmits credentials to a caller-supplied address. */
export async function organizationRequest<T>(
  body: Record<string, unknown>,
  expectedUid = useAuthStore.getState().user?.uid,
): Promise<T> {
  const apiUrl = process.env.EXPO_PUBLIC_ORGANIZATIONS_API_URL
  if (!apiUrl) throw new Error('Organization service is not configured')
  assertAccount(expectedUid)
  const token = await authProvider.getToken()
  assertAccount(expectedUid)
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  assertAccount(expectedUid)
  if (!response.ok) throw new OrganizationSyncError(response.status)
  return response.json() as Promise<T>
}
