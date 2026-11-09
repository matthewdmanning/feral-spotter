import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { randomUUID } from 'expo-crypto'
import { asyncStorage } from '@/src/shared/lib/storage'
import {
  DEFAULT_SHARING,
  type Catalog,
  type GrantRequest,
  type PermissionLedger,
  type SharingSettings,
} from '@/src/shared/types/Organizations'
import {
  organizationRequest,
  OrganizationSyncError,
} from '@/src/features/organizations/lib/api'
import { buildGrant } from '@/src/features/organizations/sharing/lib/sharing'
import { useOrganizationsFlag } from './useOrganizationsFlag'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

export type PendingOrganizationAction = {
  organizationName?: string
  mutationId: string
  organizationId: string
  requiresConfirmation?: boolean
} & (
  | { action: 'grant'; grant: GrantRequest }
  | { action: 'revoke'; submissionId: string }
  | { action: 'revokeOrganization' }
)
type NewAction = PendingOrganizationAction extends infer A
  ? A extends unknown
    ? Omit<A, 'mutationId'>
    : never
  : never
export interface AccountSharing {
  settings: SharingSettings
  preferredIds: string[]
  ledger: PermissionLedger
  outbox: PendingOrganizationAction[]
}
export interface ReviewedGrant {
  grant: GrantRequest
  organizationName: string
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
  enqueue: (uid: string, action: NewAction) => void
  /** Loads the current catalog and epoch and rebuilds the grant from current choices. */
  prepareReview: (
    uid: string,
    mutationId: string,
  ) => Promise<ReviewedGrant | null>
  /** Accepts the reviewed grant only if current choices still produce it exactly. */
  reconfirm: (
    uid: string,
    mutationId: string,
    reviewed: ReviewedGrant,
  ) => boolean
  revoke: (uid: string, organizationId: string, submissionId?: string) => void
  sync: (uid: string) => Promise<void>
}
export const EMPTY_ORGANIZATION_ACCOUNT = emptyAccount()
const STORE_NAME = 'organization-sharing-v1'
const STORE_VERSION = 0
type Persisted = Pick<SharingState, 'accounts'>
const storage = createJSONStorage<Persisted>(() => asyncStorage)
const partialize = (state: SharingState): Persisted => ({
  accounts: state.accounts,
})
const syncing = new Map<string, Promise<void>>()

const isSame = (a: PendingOrganizationAction, b: NewAction) =>
  a.action === b.action &&
  a.organizationId === b.organizationId &&
  (a.action !== 'grant' ||
    (b.action === 'grant' && a.grant.submissionId === b.grant.submissionId))
/** The wire body: only what the service reads. */
const requestBody = (item: PendingOrganizationAction) => ({
  action: item.action,
  mutationId: item.mutationId,
  organizationId: item.organizationId,
  ...(item.action === 'grant' ? { grant: item.grant } : {}),
  ...(item.action === 'revoke' ? { submissionId: item.submissionId } : {}),
})

/** User-scoped preferences, authoritative ledger cache, and durable mutation outbox. */
export const useOrganizationSharingStore = create<SharingState>()(
  persist(
    (set, get) => {
      const updateAccount = (
        uid: string,
        change: (account: AccountSharing) => Partial<AccountSharing>,
      ) =>
        set((state) => {
          const account = state.accounts[uid] ?? emptyAccount()
          return {
            accounts: {
              ...state.accounts,
              [uid]: { ...account, ...change(account) },
            },
          }
        })
      const pendingGrant = (uid: string, mutationId: string) => {
        const item = get().accounts[uid]?.outbox.find(
          (action) => action.mutationId === mutationId,
        )
        return item?.action === 'grant' && item.requiresConfirmation
          ? item
          : null
      }
      const reviewedGrant = (
        uid: string,
        item: Extract<PendingOrganizationAction, { action: 'grant' }>,
        catalogVersion: string,
        epoch: number,
      ) =>
        buildGrant({
          ...item.grant,
          catalogVersion,
          epoch,
          settings: get().accounts[uid].settings,
          email: useAuthStore.getState().user?.email,
        })
      const canReview = (uid: string) =>
        useOrganizationsFlag.getState().enabled &&
        useAuthStore.getState().user?.uid === uid
      return {
        accounts: {},
        hydrated: false,
        configure: (uid, settings) => updateAccount(uid, () => ({ settings })),
        remember: (uid, preferredIds) =>
          updateAccount(uid, () => ({ preferredIds })),
        enqueue: (uid, action) =>
          updateAccount(uid, (account) => {
            // A submitted sighting/org pair has one immutable grant, even after retries.
            const duplicate =
              action.action === 'grant' &&
              (account.outbox.some((item) => isSame(item, action)) ||
                account.ledger.permissions.some(
                  (p) =>
                    p.organizationId === action.organizationId &&
                    p.submissionId === action.grant.submissionId,
                ))
            if (duplicate) return {}
            return {
              outbox: [
                ...account.outbox,
                { ...action, mutationId: randomUUID() },
              ],
            }
          }),
        prepareReview: async (uid, mutationId) => {
          const item = pendingGrant(uid, mutationId)
          if (!item || !canReview(uid)) return null
          const [catalog, ledger] = await Promise.all([
            organizationRequest<Catalog>({ action: 'catalog' }, uid),
            organizationRequest<PermissionLedger>({ action: 'list' }, uid),
          ])
          const organization = catalog.organizations.find(
            (org) => org.id === item.organizationId && org.active,
          )
          if (!organization) return null
          return {
            organizationName: organization.name,
            grant: reviewedGrant(
              uid,
              item,
              catalog.version,
              ledger.epochs[item.organizationId] ?? 0,
            ),
          }
        },
        reconfirm: (uid, mutationId, { grant, organizationName }) => {
          const item = pendingGrant(uid, mutationId)
          if (
            !item ||
            !canReview(uid) ||
            JSON.stringify(
              reviewedGrant(uid, item, grant.catalogVersion, grant.epoch),
            ) !== JSON.stringify(grant)
          )
            return false
          updateAccount(uid, (account) => ({
            outbox: account.outbox.map((action) =>
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
          }))
          return true
        },
        revoke: (uid, organizationId, submissionId) => {
          updateAccount(uid, (account) => ({
            preferredIds: account.preferredIds.filter(
              (id) => id !== organizationId,
            ),
            outbox: account.outbox.filter(
              (item) =>
                !(
                  item.action === 'grant' &&
                  item.organizationId === organizationId &&
                  (!submissionId || item.grant.submissionId === submissionId)
                ),
            ),
          }))
          get().enqueue(
            uid,
            submissionId
              ? { action: 'revoke', organizationId, submissionId }
              : { action: 'revokeOrganization', organizationId },
          )
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
              updateAccount(uid, () => ({ ledger }))
              const skipped = new Set<string>()
              while (useAuthStore.getState().user?.uid === uid) {
                const outbox = get().accounts[uid]?.outbox ?? []
                const ready = outbox.filter(
                  (a) => !a.requiresConfirmation && !skipped.has(a.mutationId),
                )
                // Revocations go first; flag-off withholds grants but never revocations.
                const item =
                  ready.find((a) => a.action !== 'grant') ??
                  (useOrganizationsFlag.getState().enabled
                    ? ready[0]
                    : undefined)
                if (!item) break
                try {
                  const updated = await organizationRequest<PermissionLedger>(
                    requestBody(item),
                    uid,
                  )
                  updateAccount(uid, (account) => ({
                    ledger: updated,
                    outbox: account.outbox.filter(
                      (action) => action.mutationId !== item.mutationId,
                    ),
                  }))
                } catch (error) {
                  if (!(error instanceof OrganizationSyncError)) break
                  if (error.requiresConfirmation) {
                    updateAccount(uid, (account) => ({
                      outbox: account.outbox.map((action) =>
                        action.mutationId === item.mutationId
                          ? { ...action, requiresConfirmation: true }
                          : action,
                      ),
                    }))
                    continue
                  }
                  if (
                    item.action !== 'grant' ||
                    ![400, 404, 429].includes(error.status)
                  )
                    break
                  skipped.add(item.mutationId)
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
      }
    },
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage,
      partialize,
      onRehydrateStorage: () => () => {
        useOrganizationSharingStore.setState({ hydrated: true })
      },
    },
  ),
)

/**
 * The persist middleware writes without awaiting; this awaits the same write
 * so the outbox is durable before the submission draft is torn down.
 */
export async function persistOrganizationSharing(): Promise<void> {
  if (!storage) throw new Error('Organization sharing storage is unavailable')
  await storage.setItem(STORE_NAME, {
    state: partialize(useOrganizationSharingStore.getState()),
    version: STORE_VERSION,
  })
}
