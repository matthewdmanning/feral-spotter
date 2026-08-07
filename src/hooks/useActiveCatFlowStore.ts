/**
 * hooks/useActiveCatFlowStore.ts
 * Persisted zustand store holding just the in-progress cat's id across the
 * annotate -> Cat Form navigation (ADR 0004). Separate file from
 * useActiveCatFlow so it can be mocked independently in tests, matching
 * useBoundingBoxStore / useSubmissionStore / usePhotoStore.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ActiveCatFlowState {
  activeCatId: string | null
  setActiveCatId: (id: string | null) => void
}

export const useActiveCatFlowStore = create<ActiveCatFlowState>()(
  persist(
    (set) => ({
      activeCatId: null,
      setActiveCatId: (id) => set({ activeCatId: id }),
    }),
    {
      name: 'active-cat-flow-store',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
)
