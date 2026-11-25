/**
 * Scope choices to the signed-in account, restore them on a new device,
 * and send queued proof (ADR-0009).
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

function isCurrentAccount(uid: string): boolean {
  return (
    authProvider.getCurrentUser()?.uid === uid &&
    useConsentStore.getState().activeUid === uid
  )
}

async function request(
  uid: string,
  url: string,
  init: RequestInit,
): Promise<Response | undefined> {
  if (!isCurrentAccount(uid) || init.signal?.aborted) return
  const token = await authProvider.getToken()
  if (!isCurrentAccount(uid) || init.signal?.aborted) return
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

const flushing = new Map<string, Promise<void>>()
const restoring = new Map<string, Promise<void>>()

/** Send choices in order within the account. Retry from the first failure. */
export function flushConsentRecords(uid: string): Promise<void> {
  const existing = flushing.get(uid)
  if (existing) return existing
  const work = sendPending(uid).finally(() => flushing.delete(uid))
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
    state.acknowledgeRecord(next)
  }
}

async function restoreChoices(uid: string, url: string): Promise<void> {
  const { analyticsAccepted, emailOptIn } = useConsentStore.getState()
  if (analyticsAccepted !== null && emailOptIn !== null) return

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve()
    }, RESTORE_TIMEOUT_MS)
  })
  const restore = (async () => {
    const response = await request(uid, url, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!response || response.status === 410) return
    if (!response.ok) {
      throw new Error(`Consent records responded ${response.status}`)
    }
    const choices = (await response.json()) as ConsentChoices
    if (!controller.signal.aborted && isCurrentAccount(uid)) {
      useConsentStore.getState().restoreChoices(uid, choices)
    }
  })().catch((error) => {
    if (!controller.signal.aborted)
      console.warn('[accountConsent] restore', error)
  })
  await Promise.race([restore, timeout])
  clearTimeout(timer)
}

/** Scope this session and wait for its shared restore attempt before routing. */
export async function syncAccountConsent(uid: string | null): Promise<void> {
  if ((authProvider.getCurrentUser()?.uid ?? null) !== uid) return
  useConsentStore.getState().bindChoicesTo(uid)
  const url = CONSENT_RECORDS_URL
  if (uid === null || !url) return

  let restore = restoring.get(uid)
  if (!restore) {
    restore = restoreChoices(uid, url).finally(() => restoring.delete(uid))
    restoring.set(uid, restore)
  }
  await restore
  if (isCurrentAccount(uid)) {
    flushConsentRecords(uid).catch((error) =>
      console.warn('[accountConsent] send', error),
    )
  }
}
