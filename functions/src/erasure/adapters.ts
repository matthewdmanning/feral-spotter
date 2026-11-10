/**
 * Production adapters for the erasure ports. Configuration comes from
 * deployment parameters, never from literals here.
 */

import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { eraseOrganizationData } from '../organizations/store'
import { userPrefix } from '../submissionLayout'
import type {
  AccountStore,
  AnalyticsEraser,
  SubmissionStore,
} from './eraseAccount'

/**
 * PostHog "bulk delete persons" by distinct id, with events and
 * recordings. Answers 202 once the deletion is queued.
 */
export function createPostHogEraser(
  config: { host: string; projectId: string; personalApiKey: string },
  fetchImpl: typeof fetch = fetch,
): AnalyticsEraser {
  return {
    erasePerson: async (distinctId) => {
      const response = await fetchImpl(
        `${config.host}/api/projects/${config.projectId}/persons/bulk_delete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.personalApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            distinct_ids: [distinctId],
            delete_events: true,
            delete_recordings: true,
          }),
        },
      )
      if (!response.ok) {
        throw new Error(`PostHog responded ${response.status}`)
      }
    },
  }
}

export function createStorageSubmissionStore(bucket: string): SubmissionStore {
  return {
    // userPrefix ends in '/': a bare prefix would also match every uid that
    // starts with the same characters.
    deleteUserSubmissions: (uid) =>
      getStorage()
        .bucket(bucket)
        .deleteFiles({ prefix: userPrefix(uid) }),
    deleteUserOrganizationPermissions: eraseOrganizationData,
  }
}

export const authAccountStore: AccountStore = {
  deleteUser: async (uid) => {
    try {
      await getAuth().deleteUser(uid)
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return
      throw error
    }
  },
}
