import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { authProvider } from '@/src/features/auth/lib'

export class OrganizationSyncError extends Error {
  constructor(readonly status: number) {
    super(organizationErrorMessageForStatus(status))
  }
  get requiresConfirmation(): boolean {
    return this.status === 409
  }
  get retryable(): boolean {
    return [0, 408, 429, 502, 503, 504].includes(this.status)
  }
}
function organizationErrorMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Check your invite code, display name, or sharing choices and try again.'
    case 401:
      return 'Your session has expired. Sign in again to continue.'
    case 403:
      return 'You no longer have access. Refresh your memberships to check their status.'
    case 404:
      return 'The invite, organization, or shared Sighting is unavailable.'
    case 409:
      return 'Choices changed. Refresh and review again, or resume the pending leave operation.'
    case 408:
      return 'The request timed out. A change may still complete; refresh before retrying.'
    case 429:
      return 'The service limit was reached. Retry later, or leave without retaining shares.'
    case 502:
    case 503:
    case 504:
      return 'The organization service is temporarily unavailable. Please retry.'
    default:
      return 'Unable to connect. Check your connection and retry.'
  }
}
export const organizationErrorMessage = (error: unknown): string =>
  error instanceof OrganizationSyncError
    ? error.message
    : 'Unable to complete this request. Please retry.'
export const isRequestCancelled = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError'
function cancelled() {
  return Object.assign(new Error('Request cancelled'), { name: 'AbortError' })
}
function assertAccount(expectedUid: string | undefined) {
  if (!expectedUid || useAuthStore.getState().user?.uid !== expectedUid)
    throw cancelled()
}

/** Bounded requests; reads may be cancelled, while writes retain their idempotent server outcome. */
export async function organizationRequest<T>(
  body: Record<string, unknown>,
  expectedUid = useAuthStore.getState().user?.uid,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const apiUrl = process.env.EXPO_PUBLIC_ORGANIZATIONS_API_URL
  if (!apiUrl) throw new OrganizationSyncError(503)
  assertAccount(expectedUid)
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (options.signal?.aborted) throw cancelled()
  options.signal?.addEventListener('abort', abort)
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 15000)
  try {
    const token = await authProvider.getToken()
    assertAccount(expectedUid)
    if (controller.signal.aborted) throw cancelled()
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    assertAccount(expectedUid)
    if (!response.ok) throw new OrganizationSyncError(response.status)
    const result = (await response.json()) as T
    assertAccount(expectedUid)
    if (controller.signal.aborted) throw cancelled()
    return result
  } catch (error) {
    if (timedOut) throw new OrganizationSyncError(408)
    if (controller.signal.aborted || isRequestCancelled(error))
      throw cancelled()
    if (error instanceof OrganizationSyncError) throw error
    throw new OrganizationSyncError(0)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}
