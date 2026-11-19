/**
 * shared/hooks/useSubmissionStore.ts
 * Persisted Zustand store for the in-progress submission draft and its
 * observed cats.
 */

import { asyncStorage } from '@/src/shared/lib/storage'
import type {
  LocationMethod,
  TimeMethod,
} from '@/src/shared/lib/submissionCache'
import type { LibraryPickTimeResult } from '@/src/shared/utils/libraryPickTime'
import type {
  CatAge,
  CatColor,
  CatPattern,
  CatSex,
  EarTipped,
  HairLength,
  HealthLabel,
  Owned,
} from '@/src/shared/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObservedCat {
  local_id: string
  age: CatAge
  ear_tipped: EarTipped
  owned_domesticated: Owned
  pattern: CatPattern
  hair_length: HairLength
  color: CatColor
  sex: CatSex
  health_label: HealthLabel
  photo_local_ids: string[]
  photos_reviewed: boolean
  /**
   * The photo whose box the user chose as this cat's Profile Pic. Absent:
   * the first box stands in (see lib/submission/profilePhoto.ts).
   */
  profile_photo_local_id?: string
}

export interface SubmissionDraft {
  location_type: LocationMethod
  time_type: TimeMethod
  address?: string
  manual_time?: string // ISO string, set when time_type === 'manual'
  // ISO string — set only when a Library pick's EXIF DateTime was trusted
  // (ADR 0003). Camera captures and manual-fallback submissions never set it.
  captured_at?: string
  // The single Submission location, shared by every photo (see ADR 0002).
  // Set once per submission: a Live fix for `device`, or a map-picked point
  // for `pin`. Absent until acquired.
  latitude?: number
  longitude?: number
  accuracy?: number | null
  report_injured?: boolean
}

/** The one geographic point a submission is tagged with. */
export interface SubmissionLocation {
  latitude: number
  longitude: number
  accuracy?: number | null
}

export interface OrganizationSharingDraft {
  organizationNames?: Record<string, string>
  ownerUid: string
  selectedIds: string[]
  anonymous: boolean
  catalogVersion: string
  confirmedSignature: string | null
}

interface SubmissionState {
  organizationSharing: OrganizationSharingDraft | null
  setOrganizationSharing: (value: OrganizationSharingDraft | null) => void
  cats: ObservedCat[]
  submission: SubmissionDraft

  addCat: (cat: ObservedCat) => void
  updateCat: (
    localId: string,
    patch: Partial<Omit<ObservedCat, 'local_id'>>,
  ) => void
  removeCat: (localId: string) => void
  /** Drops a removed photo from every cat's photo references. */
  forgetPhoto: (photoLocalId: string) => void
  setLibraryTime: (time: LibraryPickTimeResult) => void
  setReportInjured: (injured: boolean) => void
  setLocationType: (v: LocationMethod) => void
  setSubmissionLocation: (loc: SubmissionLocation) => void
  setManualTime: (v: string) => void
  clearDraft: () => void
}

const DEFAULT_SUBMISSION: SubmissionDraft = {
  location_type: 'device',
  time_type: 'device',
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubmissionStore = create<SubmissionState>()(
  persist(
    (set) => ({
      organizationSharing: null,
      // Teardown clears the location first; stale form callbacks must not
      // recreate sharing after clearDraft(), even before navigation finishes.
      setOrganizationSharing: (organizationSharing) =>
        set((s) =>
          organizationSharing !== null &&
          (s.submission.latitude == null || s.submission.longitude == null)
            ? s
            : { organizationSharing },
        ),
      cats: [],
      submission: { ...DEFAULT_SUBMISSION },

      // Idempotent by local_id: a double-tapped Save replaces, not duplicates.
      addCat: (cat) =>
        set((s) => ({
          cats: s.cats.some((c) => c.local_id === cat.local_id)
            ? s.cats.map((c) => (c.local_id === cat.local_id ? cat : c))
            : [...s.cats, cat],
        })),

      // #299. Removes only the ObservedCat row — the cat's boxes and any
      // stale activeCatId are swept by useRemoveCat, which owns the whole
      // removal so both call sites (Cat List row, Cat Form) cannot drift.
      // Photos are deliberately untouched: the pool is submission-scoped,
      // not cat-scoped (ADR-0004), and one photo can show several cats.
      removeCat: (localId) =>
        set((s) => ({ cats: s.cats.filter((c) => c.local_id !== localId) })),

      forgetPhoto: (photoLocalId) =>
        set((s) => ({
          cats: s.cats.map((c) => ({
            ...c,
            photo_local_ids: c.photo_local_ids.filter(
              (id) => id !== photoLocalId,
            ),
            profile_photo_local_id:
              c.profile_photo_local_id === photoLocalId
                ? undefined
                : c.profile_photo_local_id,
          })),
        })),

      updateCat: (localId, patch) =>
        set((s) => ({
          cats: s.cats.map((c) =>
            c.local_id === localId
              ? { ...c, ...patch, local_id: c.local_id }
              : c,
          ),
        })),

      setLibraryTime: ({ time_type, captured_at }) =>
        set((s) => ({
          submission: {
            ...s.submission,
            time_type,
            captured_at: time_type === 'device' ? captured_at : undefined,
            manual_time:
              time_type === 'manual' ? s.submission.manual_time : undefined,
          },
        })),

      setReportInjured: (report_injured) =>
        set((s) => ({ submission: { ...s.submission, report_injured } })),

      setLocationType: (v) =>
        set((s) => ({
          submission: {
            ...s.submission,
            location_type: v,
            // Switching method invalidates any acquired coords so the new
            // method re-acquires — a device fix stays a device fix, a pinned
            // point stays a pin (ADR 0002: source determines the location).
            ...(v !== s.submission.location_type
              ? {
                  latitude: undefined,
                  longitude: undefined,
                  accuracy: undefined,
                }
              : {}),
          },
        })),

      setSubmissionLocation: (loc) =>
        set((s) => ({
          submission: {
            ...s.submission,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy ?? null,
          },
        })),

      setManualTime: (v) =>
        set((s) => ({
          submission: {
            ...s.submission,
            time_type: 'manual',
            captured_at: undefined,
            manual_time: v,
          },
        })),

      clearDraft: () =>
        set({
          organizationSharing: null,
          cats: [],
          submission: { ...DEFAULT_SUBMISSION },
        }),
    }),
    {
      name: 'submission-store',
      onRehydrateStorage: () => (state) => {
        // Legacy choices may have no location. Invalidate their confirmation
        // even when the live-form setter would reject that update.
        if (state?.organizationSharing)
          useSubmissionStore.setState({
            organizationSharing: {
              ...state.organizationSharing,
              confirmedSignature: null,
            },
          })
      },
      skipHydration: true,
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
)
