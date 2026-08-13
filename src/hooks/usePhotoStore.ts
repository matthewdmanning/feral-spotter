/**
 * hooks/usePhotoStore.ts
 * Persisted Zustand store for photos attached to the in-progress submission.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import type { SubmissionPhoto } from '@/src/types'
import { randomUUID } from 'expo-crypto'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type { SubmissionPhoto }

/** Which entrypoint populated the current draft's pool (single-source by construction, ADR 0002). */
export type PhotoSource = 'camera' | 'library' | null

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoState {
  photos: SubmissionPhoto[]
  source: PhotoSource
  // Storage upload path key (submissions/{uid}/{submissionId}/...) — generated
  // on the first photo, since the submission-cache ID (Submission Details
  // screen) doesn't exist yet at capture time. Distinct ID space from that
  // cache ID; see ADR-0005.
  submissionId: string | null

  addPhoto: (photo: SubmissionPhoto) => void
  addPhotos: (photos: SubmissionPhoto[]) => void
  updatePhoto: (localId: string, patch: Partial<SubmissionPhoto>) => void
  removePhoto: (localId: string) => void
  clearPhotos: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set) => ({
      photos: [],
      source: null,
      submissionId: null,

      // Camera-only call site (useCameraCapture.tsx) — pins source: 'camera'.
      addPhoto: (photo) =>
        set((s) => ({
          photos: [...s.photos, photo],
          source: 'camera',
          submissionId: s.submissionId ?? randomUUID(),
        })),

      // Library-only call site (useLibraryPhotoPicker.ts) — pins source: 'library'.
      addPhotos: (photos) =>
        set((s) => ({
          photos: [...s.photos, ...photos],
          source: 'library',
          submissionId: s.submissionId ?? randomUUID(),
        })),

      updatePhoto: (localId, patch) =>
        set((s) => ({
          photos: s.photos.map((p) =>
            p.local_id === localId ? { ...p, ...patch } : p,
          ),
        })),

      removePhoto: (localId) =>
        set((s) => {
          const photos = s.photos.filter((p) => p.local_id !== localId)
          return { photos, source: photos.length === 0 ? null : s.source }
        }),

      clearPhotos: () => set({ photos: [], source: null, submissionId: null }),
    }),
    {
      name: 'photo-store',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
)
