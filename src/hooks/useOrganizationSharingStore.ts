import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { randomUUID } from 'expo-crypto'
import { asyncStorage } from '@/src/lib/cache/storage'
import {
  DEFAULT_SHARING,
  effectiveSharingSettings,
  type GrantRequest,
  type PermissionLedger,
  type SharingSettings,
} from '@/src/types/Organizations'
import {
  organizationRequest,
  OrganizationSyncError,
} from '@/src/lib/organizations/api'
import { useOrganizationsFlag } from './useOrganizationsFlag'
import { useAuthStore } from '@/src/lib/auth/authStore'

export interface PendingOrganizationAction {
  organizationName?: string
  mutationId: string
  action: 'grant' | 'revoke' | 'revokeOrganization'
  organizationId: string
  submissionId?: string
  grant?: GrantRequest
  requiresConfirmation?: boolean
}
interface AccountSharing {
  settings: SharingSettings
  preferredIds: string[]
  ledger: PermissionLedger
  outbox: PendingOrganizationAction[]
}
const emptyAccount = (): AccountSharing => ({
  settings: { ...DEFAULT_SHARING, fields: { ...DEFAULT_SHARING.fields } },
  preferredIds: [],
  ledger: { epochs: {}, permissions: [] },
  outbox: [],
})
interface SharingState {
  accounts: Record<string, AccountSharing>
  hydrated: boolean
  configure: (uid: string, settings: SharingSettings) => void
  remember: (uid: string, ids: string[]) => void
  enqueue: (
    uid: string,
    action: Omit<PendingOrganizationAction, 'mutationId'>,
  ) => void
  reconfirm: (
    uid: string,
    mutationId: string,
    grant: GrantRequest,
    organizationName: string,
  ) => boolean
  revoke: (uid: string, organizationId: string, submissionId?: string) => void
  sync: (uid: string) => Promise<void>
}
export const EMPTY_ORGANIZATION_ACCOUNT = emptyAccount()
const syncing = new Map<string, Promise<void>>()

/** User-scoped preferences, authoritative ledger cache, and durable mutation outbox. */
export const useOrganizationSharingStore = create<SharingState>()(
  persist(
    (set, get) => ({
      accounts: {},
      hydrated: false,
      configure: (uid, settings) =>
        set((state) => ({
          accounts: {
            ...state.accounts,
            [uid]: { ...(state.accounts[uid] ?? emptyAccount()), settings },
          },
        })),
      remember: (uid, preferredIds) =>
        set((state) => ({
          accounts: {
            ...state.accounts,
            [uid]: { ...(state.accounts[uid] ?? emptyAccount()), preferredIds },
          },
        })),
      enqueue: (uid, action) =>
        set((state) => {
          const account = state.accounts[uid] ?? emptyAccount()
          // A submitted sighting/org pair has one immutable grant, even after retries.
          if (
            action.action === 'grant' &&
            (account.outbox.some(
              (item) =>
                item.action === 'grant' &&
                item.organizationId === action.organizationId &&
                item.grant?.submissionId === action.grant?.submissionId,
            ) ||
              account.ledger.permissions.some(
                (p) =>
                  p.organizationId === action.organizationId &&
                  p.submissionId === action.grant?.submissionId,
              ))
          )
            return state
          return {
            accounts: {
              ...state.accounts,
              [uid]: {
                ...account,
                outbox: [
                  ...account.outbox,
                  { ...action, mutationId: randomUUID() },
                ],
              },
            },
          }
        }),
      reconfirm: (uid, mutationId, grant, organizationName) => {
        const account = get().accounts[uid]
        const item = account?.outbox.find(
          (action) => action.mutationId === mutationId,
        )
        if (
          !useOrganizationsFlag.getState().enabled ||
          useAuthStore.getState().user?.uid !== uid ||
          !item?.requiresConfirmation ||
          item.action !== 'grant' ||
          item.organizationId !== grant.organizationId ||
          item.grant?.submissionId !== grant.submissionId ||
          JSON.stringify(
            effectiveSharingSettings(account.settings, grant.anonymous),
          ) !== JSON.stringify(grant.settings) ||
          (!grant.anonymous &&
            grant.settings.fields.email &&
            grant.contactEmail !== useAuthStore.getState().user?.email)
        )
          return false
        set((state) => ({
          accounts: {
            ...state.accounts,
            [uid]: {
              ...state.accounts[uid],
              outbox: state.accounts[uid].outbox.map((action) =>
                action.mutationId === mutationId
                  ? {
                      action: 'grant',
                      mutationId: randomUUID(),
                      organizationId: grant.organizationId,
                      organizationName,
                      grant,
                    }
                  : action,
              ),
            },
          },
        }))
        return true
      },
      revoke: (uid, organizationId, submissionId) => {
        set((state) => {
          const account = state.accounts[uid] ?? emptyAccount()
          return {
            accounts: {
              ...state.accounts,
              [uid]: {
                ...account,
                preferredIds: account.preferredIds.filter(
                  (id) => id !== organizationId,
                ),
                outbox: account.outbox.filter(
                  (item) =>
                    !(
                      item.action === 'grant' &&
                      item.organizationId === organizationId &&
                      (!submissionId ||
                        item.grant?.submissionId === submissionId)
                    ),
                ),
              },
            },
          }
        })
        get().enqueue(uid, {
          action: submissionId ? 'revoke' : 'revokeOrganization',
          organizationId,
          ...(submissionId ? { submissionId } : {}),
        })
        void persistOrganizationSharing()
          .then(() => get().sync(uid))
          .catch(() => {
            /* Keep visible pending state; retry remains available. */
          })
      },
      sync: (uid) => {
        const running = syncing.get(uid)
        if (running) return running
        const task = (async () => {
          if (!get().hydrated || useAuthStore.getState().user?.uid !== uid)
            return
          try {
            const ledger = await organizationRequest<PermissionLedger>(
              { action: 'list' },
              uid,
            )
            set((state) => ({
              accounts: {
                ...state.accounts,
                [uid]: { ...(state.accounts[uid] ?? emptyAccount()), ledger },
              },
            }))
            while (useAuthStore.getState().user?.uid === uid) {
              const account = get().accounts[uid]
              // Revocations bypass grants awaiting renewed confirmation.
              const item =
                account?.outbox.find(
                  (action) =>
                    !action.requiresConfirmation && action.action !== 'grant',
                ) ??
                (useOrganizationsFlag.getState().enabled
                  ? account?.outbox.find(
                      (action) => !action.requiresConfirmation,
                    )
                  : undefined)
              if (!item) break
              try {
                const updated = await organizationRequest<PermissionLedger>(
                  item as unknown as Record<string, unknown>,
                  uid,
                )
                set((state) => {
                  const current = state.accounts[uid]
                  return {
                    accounts: {
                      ...state.accounts,
                      [uid]: {
                        ...current,
                        ledger: updated,
                        outbox: current.outbox.filter(
                          (action) => action.mutationId !== item.mutationId,
                        ),
                      },
                    },
                  }
                })
              } catch (error) {
                if (
                  error instanceof OrganizationSyncError &&
                  error.requiresConfirmation
                ) {
                  set((state) => {
                    const current = state.accounts[uid]
                    return {
                      accounts: {
                        ...state.accounts,
                        [uid]: {
                          ...current,
                          outbox: current.outbox.map((action) =>
                            action.mutationId === item.mutationId
                              ? { ...action, requiresConfirmation: true }
                              : action,
                          ),
                        },
                      },
                    }
                  })
                } else break
              }
            }
          } catch {
            /* Durable outbox retries at the next foreground or reconnection. */
          }
        })().finally(() => {
          syncing.delete(uid)
        })
        syncing.set(uid, task)
        return task
      },
    }),
    {
      name: 'organization-sharing-v1',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ accounts: state.accounts }),
      onRehydrateStorage: () => () => {
        useOrganizationSharingStore.setState({ hydrated: true })
      },
    },
  ),
)

/** Acknowledges local durability before the submission draft can be torn down. */
export async function persistOrganizationSharing(): Promise<void> {
  await asyncStorage.setItem(
    'organization-sharing-v1',
    JSON.stringify({
      state: { accounts: useOrganizationSharingStore.getState().accounts },
      version: 0,
    }),
  )
}
