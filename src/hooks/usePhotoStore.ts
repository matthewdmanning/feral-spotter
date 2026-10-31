/**
 * hooks/usePhotoStore.ts
 * Persisted Zustand store for photos attached to the in-progress submission.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import type { SubmissionPhoto } from '@/src/types'
import { deleteCapturedPhotoFile } from '@/src/lib/camera/capturedPhotoFiles'
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
  // Epoch ms of the last pool change. Drives the start-up expiry and whether
  // the draft counts as restored from an earlier session. null while the pool
  // is empty, and for a pool persisted before this field existed.
  updated_at: number | null

  addPhoto: (photo: SubmissionPhoto) => void
  addPhotos: (photos: SubmissionPhoto[]) => void
  updatePhoto: (localId: string, patch: Partial<SubmissionPhoto>) => void
  removePhoto: (localId: string) => void
  clearPhotos: (deferFileDeletion?: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set) => ({
      photos: [],
      source: null,
      submissionId: null,
      updated_at: null,

      // Camera-only call site (useCameraCapture.tsx) — pins source: 'camera'.
      addPhoto: (photo) =>
        set((s) => ({
          photos: [...s.photos, photo],
          source: 'camera',
          submissionId: s.submissionId ?? randomUUID(),
          updated_at: Date.now(),
        })),

      // Library-only call site (useLibraryPhotoPicker.ts) — pins source: 'library'.
      addPhotos: (photos) =>
        set((s) => ({
          photos: [...s.photos, ...photos],
          source: 'library',
          submissionId: s.submissionId ?? randomUUID(),
          updated_at: Date.now(),
        })),

      updatePhoto: (localId, patch) =>
        set((s) => ({
          photos: s.photos.map((p) =>
            p.local_id === localId ? { ...p, ...patch } : p,
          ),
        })),

      removePhoto: (localId) =>
        set((s) => {
          const removed = s.photos.find((p) => p.local_id === localId)
          if (removed) deleteCapturedPhotoFile(removed.uri)
          const photos = s.photos.filter((p) => p.local_id !== localId)
          return {
            photos,
            source: photos.length === 0 ? null : s.source,
            updated_at: photos.length === 0 ? null : Date.now(),
          }
        }),

      clearPhotos: (deferFileDeletion = false) =>
        set((s) => {
          const uris = s.photos.map((p) => p.uri)
          const schedule =
            typeof requestIdleCallback === 'function'
              ? (callback: () => void) => requestIdleCallback(callback)
              : (callback: () => void) => setTimeout(callback, 0)
          uris.forEach((uri) => {
            if (deferFileDeletion) schedule(() => deleteCapturedPhotoFile(uri))
            else deleteCapturedPhotoFile(uri)
          })
          return {
            photos: [],
            source: null,
            submissionId: null,
            updated_at: null,
          }
        }),
    }),
    {
      name: 'photo-store',
      // The shared startup task hydrates draft stores once, after mount.
      skipHydration: true,
      storage: createJSONStorage(() => asyncStorage),
      // Repairs a persisted `source` left set with no photos to back it (e.g.
      // process death between an add and a clear finishing its async write) —
      // otherwise the lock survives restart and disables the other entrypoint
      // for good, with no photos visible to explain why.
      onRehydrateStorage: () => (state) => {
        if (state && state.photos.length === 0 && state.source !== null) {
          usePhotoStore.setState({ source: null })
        }
      },
    },
  ),
)
