import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { authProvider } from '@/src/features/auth/lib'
import { ORGANIZATION_REQUEST_TIMEOUT_MS } from '@/src/shared/config/constants'
import { organizationCopy } from '@/src/shared/config/text'

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
  const errors = organizationCopy.errors
  switch (status) {
    case 400:
      return errors.invalid
    case 401:
      return errors.sessionExpired
    case 403:
      return errors.accessLost
    case 404:
      return errors.unavailable
    case 409:
      return errors.changed
    case 408:
      return errors.timedOut
    case 429:
      return errors.limit
    case 502:
    case 503:
    case 504:
      return errors.serviceUnavailable
    default:
      return errors.connection
  }
}
export const organizationErrorMessage = (error: unknown): string =>
  error instanceof OrganizationSyncError
    ? error.message
    : organizationCopy.errors.unexpected
/** The account can no longer see this data; a temporary failure is not this. */
export const isAccessLost = (error: unknown) =>
  error instanceof OrganizationSyncError &&
  [401, 403, 404].includes(error.status)
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
  }, ORGANIZATION_REQUEST_TIMEOUT_MS)
  let rejectInterrupted: () => void = () => {}
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectInterrupted = () => reject(cancelled())
    controller.signal.addEventListener('abort', rejectInterrupted)
  })
  const perform = async (): Promise<T> => {
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
  }
  try {
    return await Promise.race([perform(), interrupted])
  } catch (error) {
    if (timedOut) throw new OrganizationSyncError(408)
    if (controller.signal.aborted || isRequestCancelled(error))
      throw cancelled()
    if (error instanceof OrganizationSyncError) throw error
    throw new OrganizationSyncError(0)
  } finally {
    clearTimeout(timer)
    controller.signal.removeEventListener('abort', rejectInterrupted)
    options.signal?.removeEventListener('abort', abort)
  }
}
