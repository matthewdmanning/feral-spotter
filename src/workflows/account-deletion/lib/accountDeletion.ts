/**
 * workflows/account-deletion/lib/accountDeletion.ts
 * Account deletion (#433): the server erases the account, then this device
 * forgets it. A workflow because the device half spans every feature that
 * keeps account data.
 *
 * Kept on the device: photos in the media library ("Keep Photos on Device").
 * They belong to the user, not the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, Paths } from 'expo-file-system'
import { authProvider } from '@/src/features/auth/lib'
import { useTutorialStore } from '@/src/features/annotate/hooks/useTutorialStore'
import { discardDraft } from '@/src/features/draft-submission/lib/draft'
import { useOrganizationDirectoryStore } from '@/src/features/organizations/hooks/useOrganizationDirectory'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useMembershipOrderStore } from '@/src/features/organizations/membership/hooks/useMembershipOrderStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { forgetPostHogDevice } from '@/src/shared/analytics/posthogClient'
import { DELETE_ACCOUNT_URL } from '@/src/shared/config/constants'
import { setThemeMode } from '@/src/shared/config/unistyles'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { mmkvInstance } from '@/src/shared/lib/storage'

/** The server needs a sign-in from the last few minutes. */
export class RecentSignInRequiredError extends Error {
  constructor() {
    super('requires-recent-login')
  }
}

/**
 * Call the `deleteAccount` callable over its HTTPS protocol. The token is
 * refreshed so it carries the sign-in time of the re-authentication just
 * done.
 */
export async function deleteAccountOnServer(
  uid: string,
  deleteSightings: boolean,
): Promise<void> {
  const url = DELETE_ACCOUNT_URL
  if (!url) throw new Error('DELETE_ACCOUNT_URL is not set')
  if (authProvider.getCurrentUser()?.uid !== uid)
    throw new Error('ACCOUNT_CHANGED')
  const token = await authProvider.getToken(true)
  if (authProvider.getCurrentUser()?.uid !== uid)
    throw new Error('ACCOUNT_CHANGED')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { deleteSightings } }),
  })
  const body = (await response.json().catch(() => null)) as {
    result?: { deleted?: boolean }
    error?: { message?: string }
  } | null
  if (response.ok && body?.result?.deleted) return
  if (body?.error?.message === 'requires-recent-login') {
    throw new RecentSignInRequiredError()
  }
  throw new Error(`Delete account responded ${response.status}`)
}

interface ResettableStore {
  getInitialState: () => object
  setState: (state: never, replace: true) => void
}

const reset = (store: ResettableStore) => () =>
  store.setState(store.getInitialState() as never, true)

/** Stores holding account or device choices, back to a first launch. */
const ACCOUNT_STORES: ResettableStore[] = [
  useConsentStore,
  useSettingsStore,
  useTutorialStore,
  useOrganizationSharingStore,
  useMembershipOrderStore,
  useOrganizationDirectoryStore,
]

function deleteCacheFiles(): void {
  for (const entry of new Directory(Paths.cache).list()) {
    try {
      entry.delete()
    } catch (error) {
      console.warn('[accountDeletion] cache entry', entry.uri, error)
    }
  }
}

/**
 * Forget the deleted account on this device: the draft, Sighting history,
 * consent and permission choices, settings, analytics identity, and the
 * app's own camera files. Each step runs even if an earlier one failed.
 */
export async function wipeDeviceData(): Promise<void> {
  forgetPostHogDevice()
  const steps: (() => unknown)[] = [
    () => discardDraft(),
    ...ACCOUNT_STORES.map(reset),
    () => mmkvInstance.clearAll(),
    () => setThemeMode('system'),
    // History rows, the current-draft pointer and every store's saved state.
    () => AsyncStorage.clear(),
    () => deleteCacheFiles(),
  ]
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      console.warn('[accountDeletion] wipe step', error)
    }
  }
}
