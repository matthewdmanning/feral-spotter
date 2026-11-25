/**
 * Scope choices to the signed-in account, refresh them from the server each
 * session, and send queued proof (ADR-0009).
 *
 * Every request has a deadline, and failures retry with bounded backoff
 * while the same account stays active, so a stalled or failed request never
 * leaves choices unsent or a cached grant unverified until some unrelated
 * event. Analytics waits for the refresh (analyticsAcceptedFor).
 */

import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { authProvider } from '@/src/features/auth/lib'
import { CONSENT_RECORDS_URL } from '@/src/shared/config/constants'
import {
  useConsentStore,
  type ConsentChoices,
} from '@/src/shared/consent/useConsentStore'

/** How long sign-in waits for restored choices before asking instead. */
export const RESTORE_TIMEOUT_MS = 4000
/** Deadline for one request, token lookup included. */
export const REQUEST_TIMEOUT_MS = 10_000
/** Waits between retries of a failed refresh or send; the last repeats. */
export const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 120_000, 600_000]

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown'

function isCurrentAccount(uid: string): boolean {
  return (
    authProvider.getCurrentUser()?.uid === uid &&
    useConsentStore.getState().activeUid === uid
  )
}

class RequestTimeoutError extends Error {}

/**
 * One request for `uid`, abandoned (undefined) if the account changes, and
 * rejected past REQUEST_TIMEOUT_MS.
 */
async function request(
  uid: string,
  url: string,
  init: RequestInit,
): Promise<Response | undefined> {
  if (!isCurrentAccount(uid)) return
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new RequestTimeoutError('Consent records request timed out'))
    }, REQUEST_TIMEOUT_MS)
  })
  try {
    return await Promise.race([
      (async () => {
        const token = await authProvider.getToken()
        if (!isCurrentAccount(uid)) return undefined
        return fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      })(),
      deadline,
    ])
  } finally {
    clearTimeout(timer)
  }
}

// ─── Retry with backoff ──────────────────────────────────────────────────────

type Work = 'send' | 'refresh'
const retries = new Map<
  string,
  { attempt: number; timer: ReturnType<typeof setTimeout> }
>()

function retryLater(uid: string, work: Work, run: () => void): void {
  const key = `${work}:${uid}`
  const previous = retries.get(key)
  if (previous) clearTimeout(previous.timer)
  const attempt = previous ? previous.attempt + 1 : 0
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
  const timer = setTimeout(() => {
    if (isCurrentAccount(uid)) run()
    else retries.delete(key)
  }, delay)
  retries.set(key, { attempt, timer })
}

function succeeded(uid: string, work: Work): void {
  const key = `${work}:${uid}`
  const previous = retries.get(key)
  if (previous) clearTimeout(previous.timer)
  retries.delete(key)
}

/** Test seam: cancel every scheduled retry. */
export function cancelConsentRetries(): void {
  for (const { timer } of retries.values()) clearTimeout(timer)
  retries.clear()
}

// ─── Send ────────────────────────────────────────────────────────────────────

const flushing = new Map<string, Promise<void>>()

/**
 * Send queued choices in order within the account. A failure stops the
 * queue and schedules a retry; it never rejects.
 */
export function flushConsentRecords(uid: string): Promise<void> {
  const existing = flushing.get(uid)
  if (existing) return existing
  const work = sendPending(uid)
    .then(() => succeeded(uid, 'send'))
    .catch((error) => {
      console.warn('[accountConsent] send', error)
      retryLater(uid, 'send', () => void flushConsentRecords(uid))
    })
    .finally(() => flushing.delete(uid))
  flushing.set(uid, work)
  return work
}

async function sendPending(uid: string): Promise<void> {
  const url = CONSENT_RECORDS_URL
  if (!url) return
  while (isCurrentAccount(uid)) {
    const { pendingRecords } = useConsentStore.getState()
    const next = pendingRecords[0]
    if (!next) return
    const response = await request(uid, url, {
      method: 'POST',
      body: JSON.stringify({
        ...next,
        platform: Platform.OS,
        appVersion: APP_VERSION,
      }),
    })
    if (!response || !isCurrentAccount(uid)) return
    const state = useConsentStore.getState()
    if (response.status === 410) {
      useConsentStore.setState({ pendingRecords: [] })
      return
    }
    if (!response.ok && response.status !== 400) {
      throw new Error(`Consent records responded ${response.status}`)
    }
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        revision?: unknown
      } | null
      if (typeof body?.revision === 'number') {
        state.noteServerRevision(uid, body.revision)
      }
    }
    useConsentStore.getState().acknowledgeRecord(next)
  }
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

const refreshing = new Map<string, Promise<void>>()

/**
 * Read the account's current choices and apply them over the cache, so a
 * revocation made elsewhere lands here. Shared per account; a failure
 * schedules a retry and never rejects.
 */
export function refreshConsentChoices(uid: string): Promise<void> {
  const url = CONSENT_RECORDS_URL
  if (!url) return Promise.resolve()
  const existing = refreshing.get(uid)
  if (existing) return existing
  const work = (async () => {
    const response = await request(uid, url, { method: 'GET' })
    if (!response) return
    if (response.status === 410) return
    if (!response.ok) {
      throw new Error(`Consent records responded ${response.status}`)
    }
    const choices = (await response.json()) as ConsentChoices
    if (isCurrentAccount(uid)) {
      useConsentStore.getState().restoreChoices(uid, choices)
    }
  })()
    .then(() => succeeded(uid, 'refresh'))
    .catch((error) => {
      console.warn('[accountConsent] refresh', error)
      retryLater(uid, 'refresh', () => void refreshConsentChoices(uid))
    })
    .finally(() => refreshing.delete(uid))
  refreshing.set(uid, work)
  return work
}

/**
 * Scope this session to `uid`, refresh its choices and send its queue.
 * Waits at most RESTORE_TIMEOUT_MS for the refresh so sign-in can route on
 * restored answers; a slower refresh still lands when it finishes.
 */
export async function syncAccountConsent(uid: string | null): Promise<void> {
  if ((authProvider.getCurrentUser()?.uid ?? null) !== uid) return
  useConsentStore.getState().bindChoicesTo(uid)
  if (uid === null || !CONSENT_RECORDS_URL) return

  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    refreshConsentChoices(uid),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, RESTORE_TIMEOUT_MS)
    }),
  ])
  clearTimeout(timer)
  if (isCurrentAccount(uid)) void flushConsentRecords(uid)
}
