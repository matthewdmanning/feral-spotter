/**
 * hooks/usePhotoStore.ts
 * Persisted Zustand store for photos attached to the in-progress submission.
 */

import { MAX_PHOTOS } from '@/src/config/constants'
import { showAlert } from '@/src/hooks/useUIStore'
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
  // Slots this draft has uploaded into. A freed slot is reused only when no
  // fresh one is left: an upload still running for a removed photo could
  // otherwise land on its replacement's object.
  usedSlots: number[]

  addPhoto: (photo: SubmissionPhoto) => void
  addPhotos: (photos: SubmissionPhoto[]) => void
  updatePhoto: (localId: string, patch: Partial<SubmissionPhoto>) => void
  removePhoto: (localId: string) => void
  clearPhotos: (deferFileDeletion?: boolean) => void
}

// ─── Slots ────────────────────────────────────────────────────────────────────

/**
 * Gives each incoming photo the lowest slot no current photo holds,
 * preferring slots this draft never used. Photos past the last free slot
 * are dropped: the entrypoints cap at MAX_PHOTOS first, so this is only a
 * backstop.
 */
function assignSlots(
  current: SubmissionPhoto[],
  usedSlots: number[],
  incoming: SubmissionPhoto[],
): { photos: SubmissionPhoto[]; usedSlots: number[] } {
  const held = new Set(current.map((p) => p.upload_slot))
  const used = new Set(usedSlots)
  const all = Array.from({ length: MAX_PHOTOS }, (_, slot) => slot)
  const photos: SubmissionPhoto[] = []
  for (const photo of incoming) {
    const free = all.filter((slot) => !held.has(slot))
    const slot = free.find((s) => !used.has(s)) ?? free[0]
    if (slot === undefined) break
    held.add(slot)
    used.add(slot)
    photos.push({ ...photo, upload_slot: slot })
  }
  return { photos, usedSlots: [...used] }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set) => ({
      photos: [],
      source: null,
      submissionId: null,
      updated_at: null,
      usedSlots: [],

      // Camera-only call site (useCameraCapture.tsx) — pins source: 'camera'.
      addPhoto: (photo) =>
        set((s) => {
          const slotted = assignSlots(s.photos, s.usedSlots, [photo])
          if (slotted.photos.length === 0) return s
          return {
            ...slotted,
            photos: [...s.photos, ...slotted.photos],
            source: 'camera',
            submissionId: s.submissionId ?? randomUUID(),
            updated_at: Date.now(),
          }
        }),

      // Library-only call site (useLibraryPhotoPicker.ts) — pins source: 'library'.
      addPhotos: (photos) =>
        set((s) => {
          const slotted = assignSlots(s.photos, s.usedSlots, photos)
          if (slotted.photos.length === 0) return s
          return {
            ...slotted,
            photos: [...s.photos, ...slotted.photos],
            source: 'library',
            submissionId: s.submissionId ?? randomUUID(),
            updated_at: Date.now(),
          }
        }),

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
            usedSlots: [],
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
        // A pool saved before slots existed: give its photos slots so
        // their uploads can still pass storage.rules.
        if (state && state.photos.some((p) => p.upload_slot == null)) {
          const kept = state.photos.filter((p) => p.upload_slot != null)
          const slotted = assignSlots(
            kept,
            state.usedSlots ?? [],
            state.photos.filter((p) => p.upload_slot == null),
          )
          usePhotoStore.setState({
            photos: state.photos.map(
              (p) => slotted.photos.find((s) => s.local_id === p.local_id) ?? p,
            ),
            usedSlots: slotted.usedSlots,
          })
        }
      },
    },
  ),
)

/** Photos the current draft can still take before MAX_PHOTOS. */
export function photoSlotsLeft(): number {
  return Math.max(0, MAX_PHOTOS - usePhotoStore.getState().photos.length)
}

export function isAtPhotoLimit(): boolean {
  return photoSlotsLeft() === 0
}

/** Shown at either entrypoint when the pool is full. */
export function showPhotoLimitReached(): void {
  showAlert(
    'Photo limit reached',
    `A Sighting holds up to ${MAX_PHOTOS} photos. Remove one to add another.`,
  )
}
