import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { asyncStorage } from '@/src/shared/lib/storage'

interface MembershipOrderState {
  /** Organization ids in the account's chosen card order, keyed by uid. */
  orders: Record<string, string[]>
  setOrder: (uid: string, organizationIds: string[]) => void
}

/** Card order is a per-device preference; the service never sees it. */
export const useMembershipOrderStore = create<MembershipOrderState>()(
  persist(
    (set) => ({
      orders: {},
      setOrder: (uid, organizationIds) =>
        set((state) => ({
          orders: { ...state.orders, [uid]: organizationIds },
        })),
    }),
    {
      name: 'organization-membership-order-v1',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ orders: state.orders }),
    },
  ),
)
