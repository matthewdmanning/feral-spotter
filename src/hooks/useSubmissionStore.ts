/**
 * hooks/useSubmissionStore.ts
 * Persisted Zustand store for the in-progress submission draft, its
 * observed cats, and the history of previously submitted submissions.
 */

import { asyncStorage } from "@/src/lib/cache/storage";
import type {
  LocationMethod,
  TimeMethod,
} from "@/src/lib/cache/submissionCache";
import type {
  CatAge,
  CatColor,
  CatPattern,
  CatSex,
  EarTipped,
  HairLength,
  HealthLevel,
  Owned,
} from "@/src/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObservedCat {
  local_id: string;
  age: CatAge;
  ear_tipped: EarTipped;
  owned_domesticated: Owned;
  pattern: CatPattern;
  hair_length: HairLength;
  color: CatColor;
  sex: CatSex;
  health: HealthLevel;
  photo_local_ids: string[];
  photos_reviewed: boolean;
}

export interface SubmissionDraft {
  location_type: LocationMethod;
  time_type: TimeMethod;
  address?: string;
  manual_time?: string; // ISO string, set when time_type === 'manual'
  // The single Submission location, shared by every photo (see ADR 0002).
  // Set once per submission: a Live fix for `device`, or a map-picked point
  // for `pin`. Absent until acquired.
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
}

/** The one geographic point a submission is tagged with. */
export interface SubmissionLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface SubmissionHistoryEntry extends SubmissionDraft {
  id: string;
  cats: ObservedCat[];
  photo_urls: string[];
  created_at: Date;
  submitted_at: Date;
  status: string;
}

interface SubmissionState {
  cats: ObservedCat[];
  submission: SubmissionDraft;
  history: SubmissionHistoryEntry[];
  currentStep: string;

  addCat: (cat: ObservedCat) => void;
  updateCat: (localId: string, patch: Partial<ObservedCat>) => void;
  setSubmission: (patch: Partial<SubmissionDraft>) => void;
  setLocationType: (v: LocationMethod) => void;
  setSubmissionLocation: (loc: SubmissionLocation) => void;
  setTimeType: (v: TimeMethod) => void;
  setAddress: (v: string) => void;
  setManualTime: (v: string) => void;
  saveDraft: () => void;
  setCurrentStep: (step: string) => void;
  addToHistory: (entry: SubmissionHistoryEntry) => void;
  clearDraft: () => void;
}

const DEFAULT_SUBMISSION: SubmissionDraft = {
  location_type: "device",
  time_type: "device",
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubmissionStore = create<SubmissionState>()(
  persist(
    (set) => ({
      cats: [],
      submission: { ...DEFAULT_SUBMISSION },
      history: [],
      currentStep: "create",

      addCat: (cat) => set((s) => ({ cats: [...s.cats, cat] })),

      updateCat: (localId, patch) =>
        set((s) => ({
          cats: s.cats.map((c) =>
            c.local_id === localId ? { ...c, ...patch } : c,
          ),
        })),

      setSubmission: (patch) =>
        set((s) => ({ submission: { ...s.submission, ...patch } })),

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

      setTimeType: (v) =>
        set((s) => ({ submission: { ...s.submission, time_type: v } })),

      setAddress: (v) =>
        set((s) => ({ submission: { ...s.submission, address: v } })),

      setManualTime: (v) =>
        set((s) => ({ submission: { ...s.submission, manual_time: v } })),

      // Draft fields already live in persisted state; nothing further to flush.
      saveDraft: () => {},

      setCurrentStep: (step) => set({ currentStep: step }),

      addToHistory: (entry) => set((s) => ({ history: [...s.history, entry] })),

      clearDraft: () =>
        set({
          cats: [],
          submission: { ...DEFAULT_SUBMISSION },
          currentStep: "create",
        }),
    }),
    {
      name: "submission-store",
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
