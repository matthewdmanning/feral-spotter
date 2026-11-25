/**
 * features/auth/lib/accountConsent.ts
 * The signed-in account's consent records (ADR-0009): scope the local
 * choices to the account, restore its choices from the server on a new
 * device, and send each queued choice as proof. Lives in auth because the
 * records belong to the account and need its ID token.
 *
 * With CONSENT_RECORDS_URL unset, choices are still scoped to the account
 * but stay on the device.
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

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown'

async function request(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${await authProvider.getToken()}`,
      'Content-Type': 'application/json',
    },
  })
}

let flushing: Promise<void> | null = null

/**
 * Send queued choices in order, one at a time. Stops at the first failure
 * so a later choice never lands before an earlier one; the next flush
 * retries. A record the server refuses as malformed (400) is dropped; an
 * erased account (410) drops them all.
 */
export function flushConsentRecords(uid: string): Promise<void> {
  flushing ??= sendPending(uid).finally(() => {
    flushing = null
  })
  return flushing
}

async function sendPending(uid: string): Promise<void> {
  const url = CONSENT_RECORDS_URL
  if (!url) return
  for (;;) {
    const { choicesUid, pendingRecords } = useConsentStore.getState()
    const next = pendingRecords[0]
    if (choicesUid !== uid || !next) return
    const response = await request(url, {
      method: 'POST',
      body: JSON.stringify({
        ...next,
        platform: Platform.OS,
        appVersion: APP_VERSION,
      }),
    })
    // Signed out or switched while sending: the queue is not ours now.
    if (useConsentStore.getState().choicesUid !== uid) return
    if (response.status === 410) {
      useConsentStore.getState().dropPendingRecords(Infinity)
      return
    }
    if (!response.ok && response.status !== 400) {
      throw new Error(`Consent records responded ${response.status}`)
    }
    useConsentStore.getState().dropPendingRecords(1)
  }
}

async function restoreChoices(uid: string, url: string): Promise<void> {
  const { analyticsAccepted, emailOptIn } = useConsentStore.getState()
  if (analyticsAccepted !== null && emailOptIn !== null) return
  const response = await request(url, { method: 'GET' })
  if (!response.ok)
    throw new Error(`Consent records responded ${response.status}`)
  useConsentStore
    .getState()
    .restoreChoices(uid, (await response.json()) as ConsentChoices)
}

function withTimeout(work: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    void work.finally(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * Scope choices to `uid` (null: signed out), restore its saved choices,
 * then send its queue. Resolves once restore finished or timed out, so a
 * caller can route on the restored answers. Network failures are expected
 * offline and only logged: the queue retries.
 */
export async function syncAccountConsent(uid: string | null): Promise<void> {
  useConsentStore.getState().bindChoicesTo(uid)
  const url = CONSENT_RECORDS_URL
  if (uid === null || !url) return
  const restore = restoreChoices(uid, url).catch((error) =>
    console.warn('[accountConsent] restore', error),
  )
  await withTimeout(restore, RESTORE_TIMEOUT_MS)
  flushConsentRecords(uid).catch((error) =>
    console.warn('[accountConsent] send', error),
  )
}
